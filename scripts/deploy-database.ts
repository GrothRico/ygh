import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

type UserRow = { identity_subject: string };

let currentStage = "configuration";

async function prepareDatabase() {
  process.umask(0o077);

  const databasePath = process.env.DATABASE_PATH;
  const ricoLogin = process.env.TAILSCALE_RICO_LOGIN;
  const secondLogin = process.env.TAILSCALE_SECOND_USER_LOGIN;
  const secondDisplayName = process.env.YGH_SECOND_USER_DISPLAY_NAME;
  if (!databasePath || !ricoLogin || !secondLogin || !secondDisplayName) {
    throw new Error("Database path and both configured user identities are required.");
  }
  if (ricoLogin === secondLogin) {
    throw new Error("The two configured user identities must be distinct.");
  }

  const databaseExisted = existsSync(databasePath);
  const initializeNewDatabase = process.env.YGH_INITIALIZE_DATABASE === "true";
  if (!databaseExisted && !initializeNewDatabase) {
    throw new Error("Creating a new database requires explicit initialization opt-in.");
  }

  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");

  try {
    if (databaseExisted) {
      currentStage = "backup";
      const backupPath = join(
        dirname(databasePath),
        `collection.predeploy-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.sqlite`,
      );
      if (existsSync(backupPath)) {
        throw new Error("The pre-deployment backup path already exists.");
      }

      await sqlite.backup(backupPath);
      const backup = new Database(backupPath, { readonly: true });
      try {
        const result = backup.pragma("integrity_check", { simple: true });
        if (result !== "ok") {
          throw new Error("The pre-deployment SQLite backup failed its integrity check.");
        }
      } finally {
        backup.close();
      }
      console.info("Created and integrity-checked a local pre-deployment SQLite backup.");
    }

    currentStage = "migration";
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: join(process.cwd(), "src/server/db/migrations") });

    currentStage = "user validation";
    const existingUsers = sqlite
      .prepare("SELECT identity_subject FROM users ORDER BY identity_subject")
      .all() as UserRow[];
    const expectedUsers = [ricoLogin, secondLogin].sort();

    if (existingUsers.length === 0 && !databaseExisted && initializeNewDatabase) {
      const insert = sqlite.prepare(
        "INSERT INTO users (id, identity_subject, display_name, active) VALUES (?, ?, ?, 1)",
      );
      const initializeUsers = sqlite.transaction(() => {
        insert.run(randomUUID(), ricoLogin, "Rico");
        insert.run(randomUUID(), secondLogin, secondDisplayName);
      });
      initializeUsers();
      console.info("Initialized the two configured application users in the new database.");
    } else if (
      existingUsers.length !== expectedUsers.length ||
      existingUsers.some((user, index) => user.identity_subject !== expectedUsers[index])
    ) {
      throw new Error(
        "Expected either a new database with explicit initialization or exactly the two configured identities.",
      );
    }
  } finally {
    sqlite.close();
  }
}

prepareDatabase().catch(() => {
  console.error(
    `Database preparation failed during ${currentStage}. ` +
      "The application remains stopped; inspect controlled local diagnostics.",
  );
  process.exitCode = 1;
});
