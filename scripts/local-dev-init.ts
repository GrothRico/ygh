import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const databasePath = "/data/collection-local.sqlite";
const identities = [
  { subject: "local-admin@ygh.invalid", displayName: "Lokaler Test-Admin" },
  { subject: "local-member@ygh.invalid", displayName: "Lokaler Testbenutzer" },
];

function validateEnvironment(environment: Record<string, string | undefined>, targetPath: string) {
  if (environment.DATABASE_PATH !== targetPath) {
    throw new Error("Local development requires its fixed database path.");
  }
  if (environment.YGH_LOCAL_DEV_USER !== "admin" && environment.YGH_LOCAL_DEV_USER !== "member") {
    throw new Error("YGH_LOCAL_DEV_USER must be admin or member.");
  }
}

function validateExistingDatabase(path: string) {
  const sqlite = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const hasUsers = sqlite.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'",
    ).get();
    if (!hasUsers) throw new Error("Existing local database is not initialized by this stack.");
    const existing = sqlite.prepare(
      "SELECT identity_subject FROM users ORDER BY identity_subject",
    ).all() as Array<{ identity_subject: string }>;
    const identitiesInDatabase = existing.map((row) => row.identity_subject);
    const expected = identities.map((user) => user.subject).sort();
    if (identitiesInDatabase.length !== expected.length || identitiesInDatabase.some((value, index) => value !== expected[index])) {
      throw new Error("Existing database does not contain exactly the two local test identities.");
    }
  } finally {
    sqlite.close();
  }
}

export function initializeLocalDatabase(
  environment: Record<string, string | undefined> = process.env,
  targetPath = databasePath,
  migrationsFolder = "/app/src/server/db/migrations",
) {
  validateEnvironment(environment, targetPath);
  const existed = existsSync(targetPath);
  if (existed) validateExistingDatabase(targetPath);

  const sqlite = new Database(targetPath);
  sqlite.pragma("foreign_keys = ON");
  try {
    migrate(drizzle(sqlite), { migrationsFolder });
    if (!existed) {
      const insert = sqlite.prepare(
        "INSERT INTO users (id, identity_subject, display_name, active) VALUES (?, ?, ?, 1)",
      );
      const seed = sqlite.transaction(() => {
        for (const identity of identities) {
          insert.run(randomUUID(), identity.subject, identity.displayName);
        }
      });
      seed();
    }
  } finally {
    sqlite.close();
  }
  process.stdout.write("Local development database is ready.\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    initializeLocalDatabase();
  } catch {
    process.stderr.write("Local development database setup failed. Application startup aborted.\n");
    process.exitCode = 1;
  }
}
