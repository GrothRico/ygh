import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { openDatabase } from "../db";
import { users } from "../db/schema";

export type AuthenticatedUser = {
  id: string;
  displayName: string;
  role: "admin" | "user";
};

export type AuthConfiguration = {
  ricoLogin: string;
  secondUserLogin: string;
  databasePath: string;
};

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
): AuthConfiguration {
  const ricoLogin = environment.TAILSCALE_RICO_LOGIN;
  const secondUserLogin = environment.TAILSCALE_SECOND_USER_LOGIN;
  const databasePath = environment.DATABASE_PATH;

  if (
    !ricoLogin ||
    !secondUserLogin ||
    !databasePath ||
    ricoLogin.trim() !== ricoLogin ||
    secondUserLogin.trim() !== secondUserLogin ||
    /[,\r\n]/.test(ricoLogin) ||
    /[,\r\n]/.test(secondUserLogin) ||
    databasePath.trim() !== databasePath ||
    ricoLogin === secondUserLogin
  ) {
    throw unavailable();
  }

  return { ricoLogin, secondUserLogin, databasePath };
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
    connection = openDatabase(configuration.databasePath);
    return await resolveAuthenticatedUser(
      requestHeaders.get("Tailscale-User-Login"),
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
