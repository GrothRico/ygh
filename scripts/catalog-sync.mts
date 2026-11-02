import Database from "better-sqlite3";
import {
  CatalogSyncError,
  readCatalogSyncStatus,
  syncCatalog,
} from "../src/server/catalog/ygoprodeck-sync.ts";

function databasePathFromEnvironment(): string {
  const databasePath = process.env.DATABASE_PATH;
  if (!databasePath || !databasePath.startsWith("/")) {
    throw new Error("DATABASE_PATH must be an absolute path.");
  }
  return databasePath;
}

function openMigratedCatalog(databasePath: string): Database.Database {
  const database = new Database(databasePath, { fileMustExist: true });
  database.pragma("foreign_keys = ON");
  const requiredTables = [
    "cards",
    "sets",
    "source_printing_observations",
    "catalog_sync_status",
    "catalog_source_payloads",
  ];
  const existingTables = new Set(
    (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name),
  );
  if (requiredTables.some((table) => !existingTables.has(table))) {
    database.close();
    throw new Error("Catalog migrations are missing.");
  }
  return database;
}

function printStatus(database: Database.Database): void {
  const status = readCatalogSyncStatus(database);
  if (!status) {
    console.log("Noch keine Katalogsynchronisierung gespeichert.");
    return;
  }
  console.log(`Quelle: ${String(status.source)}`);
  console.log(`Status: ${String(status.status)}`);
  console.log(`Letzter Versuch: ${String(status.lastAttemptAt)}`);
  console.log(`Letzter Erfolg: ${String(status.lastSuccessAt ?? "nie")}`);
  console.log(`Datenbankversion: ${String(status.databaseVersion ?? "unbekannt")}`);
  console.log(`Quelldatum: ${String(status.databaseDate ?? "unbekannt")}`);
  console.log(`Konflikte: ${String(status.conflictCount)}`);
  if (status.errorCode) console.log(`Fehlercode: ${String(status.errorCode)}`);

  let conflicts: unknown;
  try {
    conflicts = JSON.parse(String(status.conflictSummary));
  } catch {
    conflicts = [];
  }
  if (Array.isArray(conflicts)) {
    for (const conflict of conflicts) {
      if (
        typeof conflict === "object" && conflict !== null &&
        "kind" in conflict && "value" in conflict &&
        typeof conflict.kind === "string" && typeof conflict.value === "string"
      ) {
        console.log(`Konflikt: ${conflict.kind} (${conflict.value})`);
      }
    }
  }
}

async function run(): Promise<void> {
  const [command, ...extraArguments] = process.argv.slice(2);
  if ((command !== "sync" && command !== "status") || extraArguments.length > 0) {
    console.error("Verwendung: npm run catalog:sync -- sync|status");
    process.exitCode = 2;
    return;
  }

  let database: Database.Database;
  try {
    database = openMigratedCatalog(databasePathFromEnvironment());
  } catch {
    console.error("Datenbank nicht verfügbar oder Katalogmigration fehlt. DATABASE_PATH prüfen und Migration gezielt ausführen.");
    process.exitCode = 1;
    return;
  }

  try {
    if (command === "status") {
      printStatus(database);
      return;
    }

    const attemptedAt = new Date().toISOString();
    try {
      const result = await syncCatalog(database, undefined, attemptedAt);
      console.log(`Synchronisiert: ${result.cardCount} Karten, ${result.germanCardCount} deutsche Namen, ${result.setCount} Sets, ${result.observationCount} unbestätigte Druckbeobachtungen.`);
      const status = readCatalogSyncStatus(database);
      console.log(`Datenbankversion: ${String(status?.databaseVersion ?? "unbekannt")} (${String(status?.databaseDate ?? "Quelldatum nicht angegeben")})`);
      console.log(`Konflikte: ${result.conflicts.length}`);
      for (const conflict of result.conflicts.slice(0, 25)) {
        console.log(`Konflikt: ${conflict.kind} (${conflict.value})`);
      }
    } catch (error) {
      const errorCode = error instanceof CatalogSyncError
        ? error.errorCode
        : "sync_failed";
      console.error(`Katalogsynchronisierung fehlgeschlagen (${errorCode}).`);
      process.exitCode = 1;
    }
  } finally {
    database.close();
  }
}

await run();
