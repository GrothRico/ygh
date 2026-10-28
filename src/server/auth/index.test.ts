import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { headers } from "next/headers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError, getCurrentUser } from "./index";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const temporaryDirectories: string[] = [];
const testLogins = {
  rico: "rico-test@example.invalid",
  second: "second-test@example.invalid",
};

function createTemporaryDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p103-"));
  temporaryDirectories.push(directory);
  return join(directory, "test.sqlite");
}

function runMigration(databasePath: string) {
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

function addUser(
  databasePath: string,
  id: string,
  identitySubject: string,
  active = true,
) {
  const sqlite = new Database(databasePath);
  try {
    sqlite
      .prepare(
        "INSERT INTO users (id, identity_subject, display_name, active) VALUES (?, ?, ?, ?)",
      )
      .run(id, identitySubject, `Test ${id}`, active ? 1 : 0);
  } finally {
    sqlite.close();
  }
}

function configure(databasePath: string) {
  vi.stubEnv("TAILSCALE_RICO_LOGIN", testLogins.rico);
  vi.stubEnv("TAILSCALE_SECOND_USER_LOGIN", testLogins.second);
  vi.stubEnv("DATABASE_PATH", databasePath);
}

function requestAs(login: string | null, otherHeaders: Record<string, string> = {}) {
  const requestHeaders = new Headers(otherHeaders);
  if (login !== null) {
    requestHeaders.set("Tailscale-User-Login", login);
  }
  vi.mocked(headers).mockResolvedValue(
    requestHeaders as Awaited<ReturnType<typeof headers>>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Tailscale-Authentifizierung", () => {
  it("ordnet beide Logins aktiven Nutzern zu und vergibt Admin nur an Rico", async () => {
    const databasePath = createTemporaryDatabasePath();
    runMigration(databasePath);
    addUser(databasePath, "user-rico", testLogins.rico);
    addUser(databasePath, "user-second", testLogins.second);
    configure(databasePath);

    requestAs(testLogins.rico);
    await expect(getCurrentUser()).resolves.toMatchObject({
      id: "user-rico",
      role: "admin",
    });

    requestAs(testLogins.second);
    await expect(getCurrentUser()).resolves.toMatchObject({
      id: "user-second",
      role: "user",
    });
  });

  it("weist fehlende, fremde, inaktive und nicht zugeordnete Identitäten ab", async () => {
    const databasePath = createTemporaryDatabasePath();
    runMigration(databasePath);
    addUser(databasePath, "user-rico", testLogins.rico);
    addUser(databasePath, "user-disabled", testLogins.second, false);
    configure(databasePath);

    requestAs(null);
    await expect(getCurrentUser()).rejects.toMatchObject({ statusCode: 401 });

    requestAs("stranger@example.invalid");
    await expect(getCurrentUser()).rejects.toMatchObject({ statusCode: 403 });

    requestAs(testLogins.second);
    await expect(getCurrentUser()).rejects.toMatchObject({ statusCode: 403 });

    requestAs("unmapped@example.invalid");
    vi.stubEnv("TAILSCALE_SECOND_USER_LOGIN", "unmapped@example.invalid");
    await expect(getCurrentUser()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("liest Aktivstatus bei jedem Aufruf neu und ignoriert Rollen-Nebenheader", async () => {
    const databasePath = createTemporaryDatabasePath();
    runMigration(databasePath);
    addUser(databasePath, "user-second", testLogins.second);
    configure(databasePath);
    requestAs(testLogins.second, {
      "Tailscale-User-Name": "Rico Admin",
      "X-User-Role": "admin",
    });

    await expect(getCurrentUser()).resolves.toMatchObject({ role: "user" });

    const sqlite = new Database(databasePath);
    try {
      sqlite.prepare("UPDATE users SET active = 0 WHERE id = ?").run("user-second");
    } finally {
      sqlite.close();
    }

    await expect(getCurrentUser()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("verweigert fehlende und mehrdeutige Konfiguration geschlossen", async () => {
    const databasePath = createTemporaryDatabasePath();
    requestAs(testLogins.rico);
    vi.stubEnv("TAILSCALE_RICO_LOGIN", testLogins.rico);
    vi.stubEnv("TAILSCALE_SECOND_USER_LOGIN", testLogins.rico);
    vi.stubEnv("DATABASE_PATH", databasePath);
    await expect(getCurrentUser()).rejects.toBeInstanceOf(AuthenticationError);

    vi.stubEnv("TAILSCALE_SECOND_USER_LOGIN", "other@example.invalid,third@example.invalid");
    await expect(getCurrentUser()).rejects.toMatchObject({ statusCode: 503 });

    vi.stubEnv("TAILSCALE_SECOND_USER_LOGIN", "other@example.invalid\nforged@example.invalid");
    await expect(getCurrentUser()).rejects.toMatchObject({ statusCode: 503 });

    vi.stubEnv("TAILSCALE_RICO_LOGIN", "");
    await expect(getCurrentUser()).rejects.toMatchObject({ statusCode: 503 });

    vi.stubEnv("TAILSCALE_RICO_LOGIN", testLogins.rico);
    vi.stubEnv("TAILSCALE_SECOND_USER_LOGIN", testLogins.second);
    vi.stubEnv("DATABASE_PATH", "");
    await expect(getCurrentUser()).rejects.toMatchObject({ statusCode: 503 });
  });

  it("gibt bei Datenbankfehlern nur eine generische Nichtverfügbarkeit zurück", async () => {
    const missingSchemaPath = createTemporaryDatabasePath();
    configure(missingSchemaPath);
    requestAs(testLogins.rico);

    await expect(getCurrentUser()).rejects.toMatchObject({
      statusCode: 503,
      message: "Authentifizierung ist derzeit nicht verfügbar.",
    });
  });
});
