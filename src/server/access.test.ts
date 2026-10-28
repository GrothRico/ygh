import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentRequestId, logEvent, withRequestContext } from "./logging";
import {
  requireActionWriteAccess,
  withActionWriteAccess,
  withFileAccess,
  withReadAccess,
  withWriteAccess,
} from "./access";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const logins = {
  admin: "admin-test@example.invalid",
  user: "user-test@example.invalid",
  foreign: "foreign-test@example.invalid",
};
const origin = "https://cards.example.ts.net";
const temporaryDirectories: string[] = [];

function temporaryDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p104-"));
  temporaryDirectories.push(directory);
  return join(directory, "test.sqlite");
}

function migrate(databasePath: string) {
  execFileSync(
    process.execPath,
    [join(process.cwd(), "node_modules/drizzle-kit/bin.cjs"), "migrate"],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: databasePath },
      stdio: "pipe",
    },
  );
}

function addUser(databasePath: string, id: string, login: string, active = true) {
  const sqlite = new Database(databasePath);
  try {
    sqlite
      .prepare(
        "INSERT INTO users (id, identity_subject, display_name, active) VALUES (?, ?, ?, ?)",
      )
      .run(id, login, `Test ${id}`, active ? 1 : 0);
  } finally {
    sqlite.close();
  }
}

function setUserActive(databasePath: string, id: string, active: boolean) {
  const sqlite = new Database(databasePath);
  try {
    sqlite
      .prepare("UPDATE users SET active = ? WHERE id = ?")
      .run(active ? 1 : 0, id);
  } finally {
    sqlite.close();
  }
}

function requestHeaders(
  login: string | null,
  values: Record<string, string> = {},
) {
  const value = new Headers(values);
  if (login) value.set("Tailscale-User-Login", login);
  vi.mocked(headers).mockResolvedValue(value as Awaited<ReturnType<typeof headers>>);
}

function writeRequest(
  values: Record<string, string> = {},
  method = "POST",
) {
  return new Request(`${origin}/api/example`, { method, headers: values });
}

let databasePath: string;

beforeEach(() => {
  databasePath = temporaryDatabasePath();
  migrate(databasePath);
  addUser(databasePath, "admin", logins.admin);
  addUser(databasePath, "user", logins.user);
  addUser(databasePath, "inactive", logins.foreign, false);
  vi.stubEnv("TAILSCALE_RICO_LOGIN", logins.admin);
  vi.stubEnv("TAILSCALE_SECOND_USER_LOGIN", logins.user);
  vi.stubEnv("DATABASE_PATH", databasePath);
  vi.stubEnv("APP_ORIGIN", origin);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("serverseitiger Zugriffsschutz", () => {
  it("serialisiert ausschließlich feste Loggerfelder und ignoriert zusätzliche sensible Felder", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      withRequestContext((requestId) => {
        logEvent({
          event: "auth.allowed",
          status: 200,
          durationMs: 1,
          reason: "success",
          requestId: "attacker-sentinel",
          password: "pass-TOKEN",
          cookie: "cookie-TOKEN",
          nested: { token: "token-TOKEN" },
        } as Parameters<typeof logEvent>[0]);
        const [chunk] = stdout.mock.calls.at(-1) ?? [];
        const record = JSON.parse(String(chunk)) as Record<string, unknown>;
        expect(record).toEqual({
          timestamp: expect.any(String),
          level: "info",
          requestId,
          event: "auth.allowed",
          status: 200,
          durationMs: 1,
          reason: "success",
        });
        expect(String(chunk)).not.toMatch(/attacker-sentinel|pass-TOKEN|cookie-TOKEN|token-TOKEN/);
      });
    } finally {
      stdout.mockRestore();
    }
  });

  it("gibt dieselbe servergenerierte ID in Fehlerantwort und einem Auth-Log aus", async () => {
    requestHeaders(null, { "X-Request-ID": "untrusted-client-id" });
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const response = await withReadAccess(() => new Response("private"));
      const payload = await response.json() as { requestId: string; error: string };
      const lines = [...stdout.mock.calls, ...stderr.mock.calls]
        .map(([chunk]) => String(chunk)).join("").trim().split("\n");
      const matching = lines.filter((line) => line.includes(payload.requestId));

      expect(response.status).toBe(401);
      expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(payload.requestId).not.toBe("untrusted-client-id");
      expect(response.headers.get("X-Request-ID")).toBe(payload.requestId);
      expect(matching).toHaveLength(1);
      expect(JSON.parse(matching[0])).toMatchObject({ event: "auth.denied", reason: "missing_identity", status: 401 });
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });

  it("korreliert Fehlerantwort und JSON-Log, ohne Fehlertext oder fremde IDs zu übernehmen", async () => {
    requestHeaders(logins.user);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const response = await withReadAccess(() => {
        throw new Error("password=pass-TOKEN cookie=cookie-TOKEN token=token-TOKEN");
      });
      const body = await response.text();
      const logText = [...stdout.mock.calls, ...stderr.mock.calls].map(([chunk]) => String(chunk)).join("");
      const requestId = response.headers.get("X-Request-ID");

      expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(body).toContain(requestId);
      expect(body).not.toMatch(/pass-TOKEN|cookie-TOKEN|token-TOKEN|password|cookie|stack/i);
      expect(logText).toContain(requestId);
      expect(logText).toContain('"reason":"internal"');
      expect(logText).not.toMatch(/pass-TOKEN|cookie-TOKEN|token-TOKEN|password|cookie|stack/i);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });

  it("verwendet je parallelem HTTP-Aufruf eine eigene ID und ignoriert eingehende IDs", async () => {
    requestHeaders(logins.user, { "X-Request-ID": "attacker-sentinel" });
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const first = withReadAccess(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return new Response(currentRequestId());
      });
      const second = withReadAccess(() => new Response(currentRequestId()));
      const [a, b] = await Promise.all([first, second]);
      const firstId = a.headers.get("X-Request-ID");
      const secondId = b.headers.get("X-Request-ID");
      const logLines = [...stdout.mock.calls, ...stderr.mock.calls]
        .map(([chunk]) => String(chunk)).join("").trim().split("\n").map((line) => JSON.parse(line) as { requestId: string });
      expect(firstId).toMatch(/^[0-9a-f-]{36}$/);
      expect(secondId).toMatch(/^[0-9a-f-]{36}$/);
      expect(firstId).not.toBe("attacker-sentinel");
      expect(secondId).not.toBe("attacker-sentinel");
      expect(firstId).not.toBe(secondId);
      await expect(a.text()).resolves.toBe(firstId);
      await expect(b.text()).resolves.toBe(secondId);
      expect(currentRequestId()).toBeUndefined();
      expect(logLines.map((line) => line.requestId)).toEqual(expect.arrayContaining([firstId, secondId]));
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });

  it("hält Kontext und sichere ID um die vollständige Server Action", async () => {
    requestHeaders(logins.user, { Origin: origin, Host: "cards.example.ts.net" });
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const result = await withActionWriteAccess(() => {
        throw new Error("cookie=cookie-TOKEN token=token-TOKEN");
      });
      expect(result).toMatchObject({ ok: false, error: "Die Anfrage konnte nicht verarbeitet werden." });
      if (result.ok) throw new Error("Expected action failure result");
      expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/);
      const logs = [...stdout.mock.calls, ...stderr.mock.calls].map(([chunk]) => String(chunk)).join("");
      const id = logs.match(/"requestId":"([0-9a-f-]{36})"/)?.[1];
      expect(id).toBe(result.requestId);
      await expect(withActionWriteAccess(() => "done")).resolves.toEqual({ ok: true, value: "done" });
      expect(logs).not.toMatch(/cookie-TOKEN|token-TOKEN|stack/i);
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });

  it("liefert private Dateien ohne shared cache und prüft Identität", async () => {
    requestHeaders(logins.user);
    const response = await withFileAccess(() =>
      new Response("synthetischer Dateiinhalt", {
        headers: { "Content-Type": "text/plain" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.text()).resolves.toBe("synthetischer Dateiinhalt");

    const callback = vi.fn(() => new Response("privat"));
    requestHeaders(null);
    const missing = await withReadAccess(callback);
    expect(missing.status).toBe(401);
    expect(missing.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await missing.text()).not.toContain("privat");
    expect(callback).not.toHaveBeenCalled();

    requestHeaders(logins.foreign);
    expect((await withReadAccess(callback)).status).toBe(403);
    expect(callback).not.toHaveBeenCalled();

    setUserActive(databasePath, "user", false);
    requestHeaders(logins.user);
    const inactive = await withFileAccess(callback);
    expect(inactive.status).toBe(403);
    expect(inactive.headers.get("Cache-Control")).toBe("private, no-store");
    expect(callback).not.toHaveBeenCalled();
  });

  it("erzwingt Adminrechte und gibt bei unbekanntem Fehler nur 500 zurück", async () => {
    const callback = vi.fn(() => new Response("ok"));
    requestHeaders(logins.user);
    const forbidden = await withReadAccess(callback, "admin");
    expect(forbidden.status).toBe(403);
    expect(callback).not.toHaveBeenCalled();

    requestHeaders(logins.admin);
    const allowed = await withReadAccess(() => new Response("ok"), "admin");
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("Cache-Control")).toBe("private, no-store");

    requestHeaders(logins.user);
    const failed = await withReadAccess(() => {
      throw new Error("private exception details");
    });
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toContain("private exception details");
    expect(failed.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("weist GET-Mutationen vor jedem Callback ab", async () => {
    const callback = vi.fn(() => new Response("geändert"));
    requestHeaders(logins.admin);
    const response = await withWriteAccess(
      writeRequest({ Origin: origin, Host: "cards.example.ts.net" }, "GET"),
      callback,
    );
    expect(response.status).toBe(405);
    expect(callback).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("verweigert Writes auch ohne Identität, fremder Identität oder bei Sperre", async () => {
    const callback = vi.fn(() => new Response("geändert"));
    const request = () =>
      writeRequest({ Origin: origin, Host: "cards.example.ts.net" });

    requestHeaders(null);
    expect((await withWriteAccess(request(), callback)).status).toBe(401);
    requestHeaders(logins.foreign);
    expect((await withWriteAccess(request(), callback)).status).toBe(403);
    setUserActive(databasePath, "user", false);
    requestHeaders(logins.user);
    expect((await withWriteAccess(request(), callback)).status).toBe(403);
    expect(callback).not.toHaveBeenCalled();
  });

  it("vergleicht Origin und Host exakt und ignoriert Forwarded-Header", async () => {
    const callback = vi.fn(() => new Response("ok"));
    requestHeaders(logins.admin);
    const accepted = await withWriteAccess(
      writeRequest({
        Origin: origin,
        Host: "cards.example.ts.net",
        Forwarded: "host=attacker.invalid;proto=http",
        "X-Forwarded-Host": "attacker.invalid",
        "X-Forwarded-Proto": "http",
      }),
      callback,
    );
    expect(accepted.status).toBe(200);
    expect(callback).toHaveBeenCalledOnce();

    const rejectedHeaders: Record<string, string>[] = [
      { Host: "cards.example.ts.net" },
      { Origin: "https://attacker.invalid", Host: "cards.example.ts.net" },
      { Origin: origin, Host: "attacker.invalid", "X-Forwarded-Host": "cards.example.ts.net" },
      { Origin: origin },
    ];
    for (const headersValue of rejectedHeaders) {
      const rejectedCallback = vi.fn(() => new Response("should not run"));
      const response = await withWriteAccess(writeRequest(headersValue), rejectedCallback);
      expect(response.status).toBe(403);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(rejectedCallback).not.toHaveBeenCalled();
    }
  });

  it("verweigert fehlerhafte APP_ORIGIN-Konfiguration geschlossen", async () => {
    const callback = vi.fn(() => new Response("ok"));
    requestHeaders(logins.admin);
    for (const invalid of [
      "http://cards.example.ts.net",
      "https://user@cards.example.ts.net",
      "https://cards.example.ts.net/path",
      "https://cards.example.ts.net?query=1",
      "https://cards.example.ts.net#fragment",
      "",
    ]) {
      vi.stubEnv("APP_ORIGIN", invalid);
      const response = await withWriteAccess(
        writeRequest({ Origin: origin, Host: "cards.example.ts.net" }),
        callback,
      );
      expect(response.status).toBe(503);
      expect(callback).not.toHaveBeenCalled();
    }
    const configuredValue = process.env.APP_ORIGIN;
    delete process.env.APP_ORIGIN;
    const missing = await withWriteAccess(
      writeRequest({ Origin: origin, Host: "cards.example.ts.net" }),
      callback,
    );
    expect(missing.status).toBe(503);
    expect(callback).not.toHaveBeenCalled();
    process.env.APP_ORIGIN = configuredValue;
  });

  it("prüft Server Actions über Origin/Host und die gleiche Identität", async () => {
    requestHeaders(logins.user, {
      Origin: origin,
      Host: "cards.example.ts.net",
      "X-Forwarded-Host": "attacker.invalid",
    });
    await expect(requireActionWriteAccess()).resolves.toMatchObject({ role: "user" });
    await expect(requireActionWriteAccess("admin")).rejects.toMatchObject({
      statusCode: 403,
    });

    requestHeaders(logins.admin, { Origin: origin });
    await expect(requireActionWriteAccess()).rejects.toMatchObject({
      statusCode: 403,
    });

    const actionCallback = vi.fn();
    const protectedAction = async () => {
      await requireActionWriteAccess();
      actionCallback();
    };
    requestHeaders(null, { Origin: origin, Host: "cards.example.ts.net" });
    await expect(protectedAction()).rejects.toMatchObject({ statusCode: 401 });
    requestHeaders(logins.foreign, { Origin: origin, Host: "cards.example.ts.net" });
    await expect(protectedAction()).rejects.toMatchObject({ statusCode: 403 });
    setUserActive(databasePath, "user", false);
    requestHeaders(logins.user, { Origin: origin, Host: "cards.example.ts.net" });
    await expect(protectedAction()).rejects.toMatchObject({ statusCode: 403 });
    expect(actionCallback).not.toHaveBeenCalled();
  });
});
