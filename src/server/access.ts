import "server-only";

import { headers } from "next/headers";
import { currentRequestId, logEvent, withRequestContext } from "./logging";
import {
  AuthenticationError,
  getCurrentUser,
  type AuthenticatedUser,
} from "./auth";

type RequiredRole = "admin";
type ProtectedOperation = (user: AuthenticatedUser) => Response | Promise<Response>;
type AccessReason = "origin" | "method" | "role" | "configuration" | "missing_identity" | "unknown_identity" | "inactive_user" | "auth_config" | "auth_database" | "internal";

export class AccessError extends Error {
  constructor(
    readonly statusCode: 401 | 403 | 405 | 500 | 503,
    message: string,
    readonly reason: AccessReason,
    readonly requestId = currentRequestId(),
  ) {
    super(message);
    this.name = "AccessError";
  }
}

const privateHeaders = { "Cache-Control": "private, no-store" };

function errorResponse(status: number, message: string, requestId: string) {
  return Response.json(
    { error: message, requestId },
    { status, headers: { ...privateHeaders, "X-Request-ID": requestId } },
  );
}

function addPrivateNoStore(response: Response) {
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Cache-Control", "private, no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

function requireRole(user: AuthenticatedUser, requiredRole?: RequiredRole) {
  if (requiredRole === "admin" && user.role !== "admin") {
    throw new AccessError(403, "Zugriff verweigert.", "role");
  }
  return user;
}

function recordFailure(error: unknown, started: number) {
  const authReasons: readonly string[] = ["missing_identity", "unknown_identity", "inactive_user", "auth_config", "auth_database"];
  const reason: AccessReason = error instanceof AuthenticationError
    ? error.reason
    : error instanceof AccessError
      ? error.reason
      : "internal";
  const status = error instanceof AccessError || error instanceof AuthenticationError ? error.statusCode : 500;
  const isAuth = authReasons.includes(reason);
  logEvent({
    event: isAuth ? (status === 503 ? "auth.unavailable" : "auth.denied")
      : status === 401 || status === 403 || status === 405 ? "access.denied" : "request.failed",
    status,
    durationMs: performance.now() - started,
    reason,
  });
}

async function authorizeRead(requiredRole?: RequiredRole): Promise<AuthenticatedUser> {
  try {
    const started = performance.now();
    const user = await getCurrentUser();
    logEvent({ event: "auth.allowed", status: 200, durationMs: performance.now() - started, reason: "success" });
    return requireRole(user, requiredRole);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw new AccessError(error.statusCode, "Zugriff derzeit nicht möglich.", error.reason);
    }
    throw error;
  }
}

export async function requireReadAccess(requiredRole?: RequiredRole): Promise<AuthenticatedUser> {
  return withRequestContext(async () => {
    const started = performance.now();
    try {
      return await authorizeRead(requiredRole);
    } catch (error) {
      recordFailure(error, started);
      if (error instanceof AccessError) throw error;
      throw new AccessError(500, "Die Anfrage konnte nicht verarbeitet werden.", "internal");
    }
  });
}

function configuredOrigin(): URL {
  const value = process.env.APP_ORIGIN;
  if (!value) {
    throw new AccessError(503, "Zugriff ist derzeit nicht verfügbar.", "configuration");
  }

  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    throw new AccessError(503, "Zugriff ist derzeit nicht verfügbar.", "configuration");
  }

  if (
    origin.protocol !== "https:" ||
    !origin.hostname ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    value !== origin.origin
  ) {
    throw new AccessError(503, "Zugriff ist derzeit nicht verfügbar.", "configuration");
  }
  return origin;
}

function validateWriteRequest(requestHeaders: Headers, method: string) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
    throw new AccessError(405, "Diese Anfrage ist nicht zulässig.", "method");
  }

  const expectedOrigin = configuredOrigin();
  const requestOrigin = requestHeaders.get("origin");
  const requestHost = requestHeaders.get("host");
  if (
    requestOrigin !== expectedOrigin.origin ||
    !requestHost ||
    requestHost.toLowerCase() !== expectedOrigin.host.toLowerCase()
  ) {
    throw new AccessError(403, "Zugriff verweigert.", "origin");
  }
}

async function authorizeWrite(
  requestHeaders: Headers,
  method: string,
  requiredRole?: RequiredRole,
) {
  validateWriteRequest(requestHeaders, method);
  return authorizeRead(requiredRole);
}

async function runProtected(
  authorize: () => Promise<AuthenticatedUser>,
  operation: ProtectedOperation,
): Promise<Response> {
  return withRequestContext(async (requestId) => {
    const started = performance.now();
    try {
      const user = await authorize();
      const response = addPrivateNoStore(await operation(user));
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("X-Request-ID", requestId);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
    } catch (error) {
      if (error instanceof AccessError || error instanceof AuthenticationError) {
        recordFailure(error, started);
        return errorResponse(error.statusCode, error.statusCode === 503 ? "Zugriff ist derzeit nicht verfügbar." : error.statusCode === 405 ? "Diese Anfrage ist nicht zulässig." : "Zugriff verweigert.", requestId);
      }
      recordFailure(error, started);
      return errorResponse(500, "Die Anfrage konnte nicht verarbeitet werden.", requestId);
    }
  });
}

/** Protects a private HTTP read or file response and prevents shared caching. */
export function withReadAccess(
  operation: ProtectedOperation,
  requiredRole?: RequiredRole,
) {
  return runProtected(() => authorizeRead(requiredRole), operation);
}

/** Protects an HTTP mutation, including its method, origin, host, role, and response. */
export function withWriteAccess(
  request: Request,
  operation: ProtectedOperation,
  requiredRole?: RequiredRole,
) {
  return runProtected(
    () => authorizeWrite(request.headers, request.method, requiredRole),
    operation,
  );
}

/** File downloads use the same private response handling as other reads. */
export const withFileAccess = withReadAccess;

/** Server Actions are dispatched by Next.js over POST; each action still calls this guard. */
export async function requireActionWriteAccess(
  requiredRole?: RequiredRole,
): Promise<AuthenticatedUser> {
  return withRequestContext(async () => {
    const started = performance.now();
    try {
      const requestHeaders = await headers();
      return await authorizeWrite(requestHeaders, "POST", requiredRole);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        const safeError = new AccessError(error.statusCode, "Zugriff derzeit nicht möglich.", error.reason);
        recordFailure(safeError, started);
        throw safeError;
      }
      if (error instanceof AccessError) {
        recordFailure(error, started);
        throw error;
      }
      recordFailure(error, started);
      throw new AccessError(500, "Die Anfrage konnte nicht verarbeitet werden.", "internal");
    }
  });
}

/** Keeps request context, authorization and error correlation around a complete Server Action. */
export async function withActionWriteAccess<T>(
  operation: (user: AuthenticatedUser) => T | Promise<T>,
  requiredRole?: RequiredRole,
): Promise<{ ok: true; value: T } | { ok: false; error: string; requestId: string }> {
  return withRequestContext(async (requestId) => {
    const started = performance.now();
    let authorized = false;
    try {
      const requestHeaders = await headers();
      const user = await authorizeWrite(requestHeaders, "POST", requiredRole);
      authorized = true;
      return { ok: true, value: await operation(user) };
    } catch (error) {
      const failure = authorized ? new Error("Action callback failed") : error;
      recordFailure(failure, started);
      const status = !authorized && (error instanceof AccessError || error instanceof AuthenticationError) ? error.statusCode : 500;
      return {
        ok: false,
        error: status === 401 ? "Anmeldung erforderlich." : status === 405 ? "Diese Anfrage ist nicht zulässig." : status === 403 ? "Zugriff verweigert." : "Die Anfrage konnte nicht verarbeitet werden.",
        requestId,
      };
    }
  });
}

