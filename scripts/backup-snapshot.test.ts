import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import Database from "better-sqlite3";
import { createSnapshot, finalizeManifest } from "./backup-snapshot";

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "ygh-backup-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it("creates an integrity-checked Online Backup API snapshot while SQLite writes continue", async () => {
  const root = await createTemporaryDirectory();
  const sourcePath = join(root, "live.sqlite");
  const snapshotDirectory = join(root, "stage", "app");
  const database = new Database(sourcePath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE ledger (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE totals (id INTEGER PRIMARY KEY CHECK (id = 1), entry_count INTEGER NOT NULL);
    CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at INTEGER NOT NULL);
    INSERT INTO totals (id, entry_count) VALUES (1, 0);
    INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('synthetic-migration-hash', 1760000000);
  `);
  const writeEntry = database.transaction((id: number) => {
    database.prepare("INSERT INTO ledger (id, value) VALUES (?, ?)").run(id, `synthetic-${id}`);
    database.prepare("UPDATE totals SET entry_count = entry_count + 1 WHERE id = 1").run();
  });
  for (let id = 1; id <= 20_000; id += 1) writeEntry(id);

  const importsDirectory = join(root, "imports");
  await mkdir(importsDirectory);
  await writeFile(join(importsDirectory, "original.csv"), "synthetic import\n");

  const writePromises: Array<Promise<void>> = [];
  let nextId = 20_001;
  const writer = setInterval(() => {
    writesDuringBackup += 1;
    writePromises.push(Promise.resolve().then(() => writeEntry(nextId++)));
  }, 1);
  let writesDuringBackup = 0;
  try {
    const info = await createSnapshot(sourcePath, snapshotDirectory, importsDirectory);
    clearInterval(writer);
    await Promise.all(writePromises);
    expect(writesDuringBackup).toBeGreaterThan(0);
    expect(info.integrityCheck).toBe("ok");
    expect(info.importFileCount).toBe(1);
    expect(info.migrations).toEqual([{ hash: "synthetic-migration-hash", createdAt: 1760000000 }]);

    const snapshot = new Database(join(snapshotDirectory, "collection.sqlite"), { readonly: true });
    try {
      expect(snapshot.pragma("integrity_check", { simple: true })).toBe("ok");
      const count = snapshot.prepare("SELECT count(*) AS count FROM ledger").get() as { count: number };
      const total = snapshot.prepare("SELECT entry_count FROM totals WHERE id = 1").get() as { entry_count: number };
      expect(count.count).toBe(total.entry_count);
      expect(count.count).toBeGreaterThanOrEqual(20_000);
      expect(count.count).toBeLessThanOrEqual(nextId - 1);
    } finally {
      snapshot.close();
    }
    await expect(readFile(join(snapshotDirectory, "manifest.json"))).rejects.toMatchObject({ code: "ENOENT" });
    await finalizeManifest(snapshotDirectory, `sha256:${"a".repeat(64)}`);
    const manifest = JSON.parse(await readFile(join(snapshotDirectory, "manifest.json"), "utf8")) as Record<string, unknown>;
    expect(manifest).toMatchObject({
      imageId: `sha256:${"a".repeat(64)}`,
      importFileCount: 1,
      integrityCheck: "ok",
    });
    expect(manifest).not.toHaveProperty("password");
    expect(manifest).not.toHaveProperty("entries");
  } finally {
    clearInterval(writer);
    database.close();
  }
});

it("refuses a missing database instead of creating an empty backup", async () => {
  const root = await createTemporaryDirectory();
  await expect(createSnapshot(join(root, "missing.sqlite"), join(root, "stage"))).rejects.toThrow(
    "The existing application database is required for backup.",
  );
});

it("rejects symlinks in the optional imports directory", async () => {
  const root = await createTemporaryDirectory();
  const sourcePath = join(root, "live.sqlite");
  const database = new Database(sourcePath);
  database.exec("CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at INTEGER NOT NULL)");
  database.close();
  const importsDirectory = join(root, "imports");
  await mkdir(importsDirectory);
  await writeFile(join(root, "outside.csv"), "synthetic\n");
  await (await import("node:fs/promises")).symlink(join(root, "outside.csv"), join(importsDirectory, "link.csv"));
  await expect(createSnapshot(sourcePath, join(root, "stage"), importsDirectory)).rejects.toThrow(
    "Symbolic links are not allowed in the configured import directory.",
  );
});
