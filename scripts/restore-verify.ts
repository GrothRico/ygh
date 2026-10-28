import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import Database from "better-sqlite3";

type Migration = { hash: string; createdAt: number };
type Manifest = {
  createdAtUtc: string;
  imageId: string;
  databaseFile: string;
  migrations: Migration[];
  importFileCount: number;
  integrityCheck: "ok";
};
type MigrationJournal = { entries: Array<{ tag: string; when: number }> };

function requireCondition(condition: boolean): asserts condition {
  if (!condition) throw new Error("Restore validation failed.");
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const info = await lstat(path);
      requireCondition(!info.isSymbolicLink());
      if (info.isDirectory()) await visit(path);
      else if (info.isFile()) files.push(path);
      else requireCondition(false);
    }
  }
  await visit(root);
  return files;
}

async function findManifest(root: string): Promise<string> {
  const matches: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const info = await lstat(path);
      requireCondition(!info.isSymbolicLink());
      if (info.isDirectory()) await visit(path);
      else if (entry.name === "manifest.json" && info.isFile() && basename(directory) === "app") {
        matches.push(path);
      }
    }
  }
  await visit(root);
  requireCondition(matches.length === 1);
  return matches[0];
}

async function imageMigrations(): Promise<Migration[]> {
  const directory = "/app/src/server/db/migrations";
  const journal = JSON.parse(await readFile(join(directory, "meta/_journal.json"), "utf8")) as MigrationJournal;
  requireCondition(Array.isArray(journal.entries) && journal.entries.length > 0);
  const migrations: Migration[] = [];
  for (const entry of journal.entries) {
    requireCondition(/^[a-zA-Z0-9_-]+$/.test(entry.tag) && Number.isSafeInteger(entry.when));
    const sql = await readFile(join(directory, `${entry.tag}.sql`));
    migrations.push({ hash: createHash("sha256").update(sql).digest("hex"), createdAt: entry.when });
  }
  return migrations;
}

function jsonEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function main(): Promise<void> {
  const restoreRoot = process.argv[2];
  requireCondition(Boolean(restoreRoot));

  const manifestPath = await findManifest(restoreRoot);
  const dataDirectory = dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  requireCondition(
    /^sha256:[a-f0-9]{64}$/.test(manifest.imageId) &&
      manifest.imageId === process.env.YGH_RESTORE_IMAGE_ID &&
      manifest.databaseFile === "collection.sqlite" &&
      manifest.integrityCheck === "ok" &&
      Array.isArray(manifest.migrations) &&
      Number.isInteger(manifest.importFileCount) &&
      manifest.importFileCount >= 0 &&
      Number.isFinite(Date.parse(manifest.createdAtUtc)),
  );

  const database = new Database(join(dataDirectory, manifest.databaseFile), {
    readonly: true,
    fileMustExist: true,
  });
  let restoredMigrations: Migration[];
  try {
    requireCondition(database.pragma("integrity_check", { simple: true }) === "ok");
    restoredMigrations = database
      .prepare("SELECT hash, created_at AS createdAt FROM __drizzle_migrations ORDER BY created_at")
      .all() as Migration[];
  } finally {
    database.close();
  }

  const bundledMigrations = await imageMigrations();
  requireCondition(
    jsonEquals(restoredMigrations, manifest.migrations) &&
      jsonEquals(restoredMigrations, bundledMigrations),
  );

  const importsPath = join(dataDirectory, "imports");
  let importCount = 0;
  try {
    const info = await lstat(importsPath);
    requireCondition(!info.isSymbolicLink() && info.isDirectory());
    importCount = (await listFiles(importsPath)).length;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  requireCondition(importCount === manifest.importFileCount);

  console.log(
    `Restore verification passed: exact image, ${restoredMigrations.length} migrations, ${importCount} import files.`,
  );
}

main().catch(() => {
  console.error("Restore verification failed; the isolated target was left unchanged.");
  process.exitCode = 1;
});
