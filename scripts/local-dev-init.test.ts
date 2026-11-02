import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeLocalDatabase } from "./local-dev-init";

const directories: string[] = [];
const migrationsFolder = join(process.cwd(), "src/server/db/migrations");

function makeDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p116-local-"));
  directories.push(directory);
  return join(directory, "collection-local.sqlite");
}

function initialize(path: string) {
  initializeLocalDatabase({ DATABASE_PATH: path, YGH_LOCAL_DEV_USER: "admin" }, path, migrationsFolder);
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("lokale Datenbankinitialisierung", () => {
  it("migriert und seedet genau zwei synthetische Benutzer; Neustarts erhalten Status und IDs", () => {
    const path = makeDatabasePath();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    initialize(path);
    let sqlite = new Database(path);
    const initial = sqlite.prepare(
      "SELECT id, identity_subject, active FROM users ORDER BY identity_subject",
    ).all() as Array<{ id: string; identity_subject: string; active: number }>;
    expect(initial).toHaveLength(2);
    expect(initial.map(({ identity_subject }) => identity_subject)).toEqual([
      "local-admin@ygh.invalid",
      "local-member@ygh.invalid",
    ]);
    sqlite.prepare("UPDATE users SET active = 0 WHERE identity_subject = ?").run("local-member@ygh.invalid");
    sqlite.close();

    initialize(path);
    sqlite = new Database(path);
    const restarted = sqlite.prepare(
      "SELECT id, identity_subject, active FROM users ORDER BY identity_subject",
    ).all();
    sqlite.close();
    expect(restarted).toEqual(initial.map((user) => ({
      ...user,
      active: user.identity_subject === "local-member@ygh.invalid" ? 0 : 1,
    })));
  });

  it("weist eine vorhandene fremde Benutzerdatenbank ohne Änderung zurück", () => {
    const path = makeDatabasePath();
    const sqlite = new Database(path);
    sqlite.exec("CREATE TABLE users (id TEXT PRIMARY KEY, identity_subject TEXT NOT NULL)");
    sqlite.prepare("INSERT INTO users VALUES (?, ?)").run("real-user", "owner@example.invalid");
    sqlite.close();
    const before = createHash("sha256").update(readFileSync(path)).digest("hex");

    expect(() => initialize(path)).toThrow("exactly the two local test identities");
    expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(before);
  });

  it("stellt einen fehlenden lokalen Benutzer bei einem Wiederstart nicht wieder her", () => {
    const path = makeDatabasePath();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    initialize(path);
    const sqlite = new Database(path);
    sqlite.prepare("DELETE FROM users WHERE identity_subject = ?").run("local-member@ygh.invalid");
    sqlite.close();

    expect(() => initialize(path)).toThrow("exactly the two local test identities");
    const check = new Database(path, { readonly: true });
    const count = check.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
    check.close();
    expect(count.count).toBe(1);
  });
});
