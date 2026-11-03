import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { openDatabase } from "../db";
import { users } from "../db/schema";

export type AuthenticatedUser = {
  id: string;
  displayName: string;
  role: "admin" | "user";
  authMode: "tailscale" | "local";
};

export type AuthConfiguration = {
  ricoLogin: string;
  secondUserLogin: string;
  databasePath: string;
  localDevUser: "admin" | "member" | null;
};

export const LOCAL_DEV_IDENTITIES = {
  admin: { subject: "local-admin@ygh.invalid", displayName: "Lokaler Test-Admin", role: "admin" },
  member: { subject: "local-member@ygh.invalid", displayName: "Lokaler Testbenutzer", role: "user" },
} as const;

export class AuthenticationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 401 | 403 | 503,
    readonly reason: "missing_identity" | "unknown_identity" | "inactive_user" | "auth_config" | "auth_database",
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

const unavailable = () =>
  new AuthenticationError("Authentifizierung ist derzeit nicht verfügbar.", 503, "auth_config");

export function readAuthConfiguration(
  environment: Record<string, string | undefined>,
  localBuildAllowed = process.env.YGH_LOCAL_DEV_BUILD_ALLOWED === "true",
  nodeEnvironment = process.env.NODE_ENV,
): AuthConfiguration {
  const requestedLocalUser = environment.YGH_LOCAL_DEV_USER;
  let localDevUser: AuthConfiguration["localDevUser"] = null;
  if (requestedLocalUser !== undefined) {
    if (
      !localBuildAllowed ||
      nodeEnvironment !== "development" ||
      (requestedLocalUser !== "admin" && requestedLocalUser !== "member")
    ) {
      throw unavailable();
    }
    localDevUser = requestedLocalUser;
  }

  const databasePath = environment.DATABASE_PATH;
  if (!databasePath || databasePath.trim() !== databasePath) throw unavailable();

  if (localDevUser !== null) {
    return {
      ricoLogin: LOCAL_DEV_IDENTITIES.admin.subject,
      secondUserLogin: LOCAL_DEV_IDENTITIES.member.subject,
      databasePath,
      localDevUser,
    };
  }

  const ricoLogin = environment.TAILSCALE_RICO_LOGIN;
  const secondUserLogin = environment.TAILSCALE_SECOND_USER_LOGIN;

  if (
    !ricoLogin ||
    !secondUserLogin ||
    !databasePath ||
    ricoLogin.trim() !== ricoLogin ||
    secondUserLogin.trim() !== secondUserLogin ||
    /[,\r\n]/.test(ricoLogin) ||
    /[,\r\n]/.test(secondUserLogin) ||
    ricoLogin === secondUserLogin
  ) {
    throw unavailable();
  }

  return { ricoLogin, secondUserLogin, databasePath, localDevUser };
}

export function isLocalDevelopmentRequested(environment = process.env): boolean {
  return environment.YGH_LOCAL_DEV_USER !== undefined;
}

type AuthDatabase = ReturnType<typeof openDatabase>["db"];

export async function resolveAuthenticatedUser(
  identityLogin: string | null,
  configuration: AuthConfiguration,
  db: AuthDatabase,
): Promise<AuthenticatedUser> {
  if (!identityLogin) {
    throw new AuthenticationError("Anmeldung erforderlich.", 401, "missing_identity");
  }

  if (
    identityLogin !== configuration.ricoLogin &&
    identityLogin !== configuration.secondUserLogin
  ) {
    throw new AuthenticationError("Zugriff verweigert.", 403, "unknown_identity");
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        active: users.active,
      })
      .from(users)
      .where(eq(users.identitySubject, identityLogin))
      .limit(1);

    if (!user || !user.active) {
      throw new AuthenticationError("Zugriff verweigert.", 403, "inactive_user");
    }

    return {
      id: user.id,
      displayName: user.displayName,
      role: identityLogin === configuration.ricoLogin ? "admin" : "user",
      authMode: configuration.localDevUser === null ? "tailscale" : "local",
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError("Authentifizierung ist derzeit nicht verfügbar.", 503, "auth_database");
  }
}

/** Resolves the current Serve identity and active application user for this request. */
export async function getCurrentUser(): Promise<AuthenticatedUser> {
  const configuration = readAuthConfiguration(process.env);
  let connection: ReturnType<typeof openDatabase> | undefined;

  try {
    const requestHeaders = await headers();
    if (configuration.localDevUser !== null && requestHeaders.get("host") !== "127.0.0.1:13001") {
      throw new AuthenticationError("Zugriff verweigert.", 403, "unknown_identity");
    }
    connection = openDatabase(configuration.databasePath);
    const identityLogin = configuration.localDevUser === null
      ? requestHeaders.get("Tailscale-User-Login")
      : LOCAL_DEV_IDENTITIES[configuration.localDevUser].subject;
    return await resolveAuthenticatedUser(
      identityLogin,
      configuration,
      connection.db,
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError("Authentifizierung ist derzeit nicht verfügbar.", 503, "auth_database");
  } finally {
    try {
      connection?.close();
    } catch {
      throw new AuthenticationError("Authentifizierung ist derzeit nicht verfügbar.", 503, "auth_database");
    }
  }
}
