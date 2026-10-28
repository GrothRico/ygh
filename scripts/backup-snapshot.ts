import { chmod, copyFile, lstat, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";

const IMPORTS_PATH = "/data/imports";
const DATABASE_PATH = "/data/collection.sqlite";
const SNAPSHOT_DATABASE_NAME = "collection.sqlite";
const SNAPSHOT_INFO_NAME = ".snapshot-info.json";

async function lstatIfPresent(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

type SnapshotInfo = {
  databaseFile: string;
  importFileCount: number;
  integrityCheck: "ok";
  migrations: Array<{ hash: string; createdAt: number }>;
};

async function copyImportTree(sourcePath: string, destinationPath: string): Promise<number> {
  const sourceStat = await lstat(sourcePath);
  if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
    throw new Error("The configured import directory must be a real directory.");
  }

  await mkdir(destinationPath, { recursive: true, mode: 0o700 });
  let fileCount = 0;
  const entries = await readdir(sourcePath, { withFileTypes: true });
  for (const entry of entries) {
    const sourceEntry = join(sourcePath, entry.name);
    const destinationEntry = join(destinationPath, entry.name);
    const entryStat = await lstat(sourceEntry);
    if (entryStat.isSymbolicLink()) {
      throw new Error("Symbolic links are not allowed in the configured import directory.");
    }
    if (entryStat.isDirectory()) {
      fileCount += await copyImportTree(sourceEntry, destinationEntry);
      continue;
    }
    if (!entryStat.isFile()) {
      throw new Error("Only regular files and directories are allowed in the import directory.");
    }
    await copyFile(sourceEntry, destinationEntry);
    await chmod(destinationEntry, 0o600);
    fileCount += 1;
  }
  return fileCount;
}

export async function createSnapshot(
  sourcePath: string,
  snapshotDirectory: string,
  importsPath = IMPORTS_PATH,
): Promise<SnapshotInfo> {
  const sourceStat = await lstatIfPresent(sourcePath);
  if (!sourceStat?.isFile() || sourceStat.isSymbolicLink()) {
    throw new Error("The existing application database is required for backup.");
  }

  const databasePath = join(snapshotDirectory, SNAPSHOT_DATABASE_NAME);
  const infoPath = join(snapshotDirectory, SNAPSHOT_INFO_NAME);
  if (resolve(sourcePath) === resolve(databasePath)) {
    throw new Error("The snapshot destination cannot replace the live database.");
  }
  await mkdir(snapshotDirectory, { recursive: true, mode: 0o700 });
  if ((await readdir(snapshotDirectory)).length > 0) {
    throw new Error("The snapshot staging directory must be empty.");
  }

  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(databasePath, { progress: () => 2 });
    await chmod(databasePath, 0o600);
  } finally {
    source.close();
  }

  const snapshot = new Database(databasePath, { readonly: true, fileMustExist: true });
  let info: SnapshotInfo;
  try {
    const integrityCheck = snapshot.pragma("integrity_check", { simple: true });
    if (integrityCheck !== "ok") {
      throw new Error("The SQLite snapshot failed its integrity check.");
    }
    const migrationRows = snapshot
      .prepare("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at")
      .all() as Array<{ hash: string; created_at: number }>;
    let importFileCount = 0;
    const importsStat = await lstatIfPresent(importsPath);
    if (importsStat) {
      importFileCount = await copyImportTree(importsPath, join(snapshotDirectory, "imports"));
    }
    info = {
      databaseFile: SNAPSHOT_DATABASE_NAME,
      importFileCount,
      integrityCheck: "ok",
      migrations: migrationRows.map(({ hash, created_at }) => ({ hash, createdAt: created_at })),
    };
  } finally {
    snapshot.close();
  }
  await writeFile(infoPath, `${JSON.stringify(info)}\n`, { flag: "wx", mode: 0o600 });
  return info;
}

export async function finalizeManifest(snapshotDirectory: string, imageId: string): Promise<void> {
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) {
    throw new Error("The immutable application image ID is required.");
  }
  const infoPath = join(snapshotDirectory, SNAPSHOT_INFO_NAME);
  const info = JSON.parse(await readFile(infoPath, "utf8")) as SnapshotInfo;
  if (info.integrityCheck !== "ok" || info.databaseFile !== SNAPSHOT_DATABASE_NAME) {
    throw new Error("The staged database snapshot metadata is invalid.");
  }
  const manifest = {
    createdAtUtc: new Date().toISOString(),
    imageId,
    databaseFile: info.databaseFile,
    migrations: info.migrations,
    importFileCount: info.importFileCount,
    integrityCheck: info.integrityCheck,
  };
  await writeFile(join(snapshotDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  await rm(infoPath);
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const snapshotDirectory = resolve(process.env.YGH_BACKUP_STAGE ?? "/backup/app");
  if (mode === "snapshot") {
    await createSnapshot(DATABASE_PATH, snapshotDirectory);
    return;
  }
  if (mode === "finalize") {
    const imageId = process.env.YGH_BACKUP_IMAGE_ID;
    if (!imageId) throw new Error("The immutable application image ID is required.");
    await finalizeManifest(snapshotDirectory, imageId);
    return;
  }
  throw new Error("Expected backup mode: snapshot or finalize.");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => {
    console.error("Backup snapshot preparation failed.");
    process.exitCode = 1;
  });
}
