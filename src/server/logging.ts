import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type OperationContext = { requestId: string };
type LogEvent = {
  event: "auth.allowed" | "auth.denied" | "auth.unavailable" | "access.denied" | "request.failed";
  status: number;
  durationMs: number;
  reason: "success" | "missing_identity" | "unknown_identity" | "inactive_user" | "auth_config" | "auth_database" | "origin" | "method" | "role" | "configuration" | "internal";
};

const operationStorage = new AsyncLocalStorage<OperationContext>();

export function withRequestContext<T>(operation: (requestId: string) => T): T {
  const existing = operationStorage.getStore();
  if (existing) return operation(existing.requestId);
  const requestId = randomUUID();
  return operationStorage.run({ requestId }, () => operation(requestId));
}

export function currentRequestId(): string | undefined {
  return operationStorage.getStore()?.requestId;
}

export function logEvent(event: LogEvent): void {
  const requestId = currentRequestId();
  if (!requestId) return;
  const allowedEvents = ["auth.allowed", "auth.denied", "auth.unavailable", "access.denied", "request.failed"];
  const allowedReasons = ["success", "missing_identity", "unknown_identity", "inactive_user", "auth_config", "auth_database", "origin", "method", "role", "configuration", "internal"];
  if (!allowedEvents.includes(event.event) || !allowedReasons.includes(event.reason)) return;
  const status = Number.isInteger(event.status) && event.status >= 100 && event.status <= 599 ? event.status : 500;
  const durationMs = Number.isFinite(event.durationMs) ? Math.max(0, Math.round(event.durationMs)) : 0;
  const record = {
    timestamp: new Date().toISOString(),
    level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
    requestId,
    event: event.event,
    status,
    durationMs,
    reason: event.reason,
  };
  const output = JSON.stringify(record);
  if (status >= 500) process.stderr.write(`${output}\n`);
  else process.stdout.write(`${output}\n`);
}
