import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { users } from "./schema";

vi.mock("server-only", () => ({}));

const temporaryDirectories: string[] = [];

function createTemporaryDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p102-"));
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

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("SQLite-Migrationen", () => {
  it("migriert wiederholt, erhält vorhandene Daten und erzwingt Constraints", async () => {
    const databasePath = createTemporaryDatabasePath();
    runMigration(databasePath);

    const sqlite = new Database(databasePath);
    try {
      sqlite
        .prepare(
          "INSERT INTO users (id, identity_subject, display_name, active) VALUES (?, ?, ?, ?)",
        )
        .run("synthetic-user-1", "synthetic-subject-1", "Testnutzer", 1);
    } finally {
      sqlite.close();
    }

    runMigration(databasePath);

    const migrated = new Database(databasePath);
    try {
      expect(
        migrated
          .prepare("SELECT id, identity_subject, display_name, active FROM users")
          .get(),
      ).toEqual({
        id: "synthetic-user-1",
        identity_subject: "synthetic-subject-1",
        display_name: "Testnutzer",
        active: 1,
      });
      expect(() =>
        migrated
          .prepare(
            "INSERT INTO users (id, identity_subject, display_name, active) VALUES (?, ?, ?, ?)",
          )
          .run("synthetic-user-2", "synthetic-subject-1", "Duplikat", 1),
      ).toThrow(/UNIQUE constraint failed/);
      expect(() =>
        migrated
          .prepare(
            "INSERT INTO users (id, identity_subject, display_name, active) VALUES (?, ?, ?, ?)",
          )
          .run("synthetic-user-3", "synthetic-subject-3", "Ungültig", 2),
      ).toThrow(/CHECK constraint failed/);
    } finally {
      migrated.close();
    }

    const { openDatabase } = await import("./index");
    const connection = openDatabase(databasePath);
    try {
      expect(connection.db.$client.pragma("foreign_keys")).toEqual([{ foreign_keys: 1 }]);
      expect(await connection.db.select().from(users)).toEqual([
        {
          id: "synthetic-user-1",
          identitySubject: "synthetic-subject-1",
          displayName: "Testnutzer",
          active: true,
        },
      ]);
    } finally {
      connection.close();
    }
  });
});
