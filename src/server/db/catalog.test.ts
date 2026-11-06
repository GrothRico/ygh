import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { syntheticCatalog } from "./__tests__/fixtures/catalog";

vi.mock("server-only", () => ({}));

const temporaryDirectories: string[] = [];

function createTemporaryDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p201-"));
  temporaryDirectories.push(directory);
  return join(directory, "test.sqlite");
}

function createInitialMigrationsFolder() {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p201-migrations-"));
  temporaryDirectories.push(directory);
  const migrationsFolder = join(directory, "migrations");
  const metadataFolder = join(migrationsFolder, "meta");
  mkdirSync(metadataFolder, { recursive: true });

  const sourceFolder = join(process.cwd(), "src/server/db/migrations");
  const journal = JSON.parse(
    readFileSync(join(sourceFolder, "meta/_journal.json"), "utf8"),
  ) as {
    version: string;
    dialect: string;
    entries: Array<{
      idx: number;
      version: string;
      when: number;
      tag: string;
      breakpoints: boolean;
    }>;
  };
  const initialEntry = journal.entries.find((entry) => entry.idx === 0);
  if (!initialEntry) {
    throw new Error("Die vorhandene 0000-Migration fehlt.");
  }
  writeFileSync(
    join(metadataFolder, "_journal.json"),
    JSON.stringify({ ...journal, entries: [initialEntry] }, null, 2),
  );
  copyFileSync(
    join(sourceFolder, `${initialEntry.tag}.sql`),
    join(migrationsFolder, `${initialEntry.tag}.sql`),
  );
  return migrationsFolder;
}

function createMigrationsFolderThrough(maxIndex: number) {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p208-migrations-"));
  temporaryDirectories.push(directory);
  const migrationsFolder = join(directory, "migrations");
  const metadataFolder = join(migrationsFolder, "meta");
  mkdirSync(metadataFolder, { recursive: true });
  const sourceFolder = join(process.cwd(), "src/server/db/migrations");
  const journal = JSON.parse(readFileSync(join(sourceFolder, "meta/_journal.json"), "utf8")) as {
    version: string; dialect: string; entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }>;
  };
  const entries = journal.entries.filter((entry) => entry.idx <= maxIndex);
  writeFileSync(join(metadataFolder, "_journal.json"), JSON.stringify({ ...journal, entries }, null, 2));
  for (const entry of entries) copyFileSync(join(sourceFolder, `${entry.tag}.sql`), join(migrationsFolder, `${entry.tag}.sql`));
  return migrationsFolder;
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

function openMigratedDatabase() {
  const databasePath = createTemporaryDatabasePath();
  runMigration(databasePath);
  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  return database;
}

function insertSyntheticCatalog(database: Database.Database) {
  const { card, set, variant, printings } = syntheticCatalog;
  database
    .prepare(
      "INSERT INTO cards (id, name_de, name_en, effect_de, effect_en) VALUES (?, ?, ?, ?, ?)",
    )
    .run(card.id, card.nameDe, card.nameEn, card.effectDe, card.effectEn);
  database
    .prepare(
      "INSERT INTO sets (id, name, code, catalog_status) VALUES (?, ?, ?, ?)",
    )
    .run(set.id, set.name, set.code, set.catalogStatus);
  database
    .prepare(
      "INSERT INTO variants (id, card_id, set_id, collector_number, edition, rarity, artwork_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      variant.id,
      variant.cardId,
      variant.setId,
      variant.collectorNumber,
      variant.edition,
      variant.rarity,
      variant.artworkKey,
    );
  const insertPrinting = database.prepare(
    "INSERT INTO printings (id, variant_id, language, printed_code, source, source_id) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const printing of printings) {
    insertPrinting.run(
      printing.id,
      printing.variantId,
      printing.language,
      printing.printedCode,
      printing.source,
      printing.sourceId,
    );
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("SQLite-Katalogmigration", () => {
  it("erweitert eine Datenbank mit nur 0000 und erhält vorhandene Benutzer", () => {
    const databasePath = createTemporaryDatabasePath();
    const migrationsFolder = createInitialMigrationsFolder();
    const initial = new Database(databasePath);
    try {
      migrate(drizzle(initial), { migrationsFolder });
      expect(
        initial.prepare("SELECT count(*) AS count FROM __drizzle_migrations").get(),
      ).toEqual({ count: 1 });
      initial
        .prepare(
          "INSERT INTO users (id, identity_subject, display_name, active) VALUES (?, ?, ?, ?)",
        )
        .run("fixture-user-001", "fixture-subject-001", "Testnutzer", 1);
    } finally {
      initial.close();
    }

    runMigration(databasePath);
    const afterUpgrade = new Database(databasePath);
    afterUpgrade.pragma("foreign_keys = ON");
    insertSyntheticCatalog(afterUpgrade);
    afterUpgrade.close();
    runMigration(databasePath);

    const migrated = new Database(databasePath);
    try {
      expect(
        migrated
          .prepare(
            "SELECT id, identity_subject, display_name, active FROM users",
          )
          .get(),
      ).toEqual({
        id: "fixture-user-001",
        identity_subject: "fixture-subject-001",
        display_name: "Testnutzer",
        active: 1,
      });
      expect(
        migrated
          .prepare("SELECT id, name_en FROM cards")
          .get(),
      ).toEqual({ id: "fixture-card-001", name_en: "Example Dragon" });
      expect(
        migrated
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('activity_log', 'cards', 'locations', 'sets', 'stock', 'variants', 'printings', 'catalog_source_payloads') ORDER BY name",
          )
          .all(),
      ).toEqual([
        { name: "activity_log" },
        { name: "cards" },
        { name: "catalog_source_payloads" },
        { name: "locations" },
        { name: "printings" },
        { name: "sets" },
        { name: "stock" },
        { name: "variants" },
      ]);
      expect(
        migrated
          .prepare("SELECT count(*) AS count FROM __drizzle_migrations")
          .get(),
      ).toEqual({ count: 10 });
    } finally {
      migrated.close();
    }
  });

  it("migriert 0008 mit Fremdschlüsseln aktiv und erhält Bestand, Drucke und Auditdetails", () => {
    const databasePath = createTemporaryDatabasePath();
    const priorMigrations = createMigrationsFolderThrough(8);
    const database = new Database(databasePath);
    database.pragma("foreign_keys = ON");
    try {
      migrate(drizzle(database), { migrationsFolder: priorMigrations });
      database.prepare("INSERT INTO users (id, identity_subject, display_name) VALUES ('user-a', 'subject-a', 'Test')").run();
      database.prepare("INSERT INTO cards (id, name_en) VALUES ('card-a', 'Synthetic card')").run();
      database.prepare("INSERT INTO sets (id, name, code) VALUES ('set-a', 'Synthetic set', 'SYN')").run();
      database.prepare("INSERT INTO locations (id, name, kind) VALUES ('loc-a', 'Box', 'folder')").run();
      const insertVariant = database.prepare("INSERT INTO variants (id, card_id, set_id, collector_number, edition, rarity, artwork_key) VALUES (?, 'card-a', 'set-a', ?, ?, 'Common', 'default')");
      for (const edition of ["first", "unlimited", "not_applicable"]) insertVariant.run(`variant-${edition}`, edition, edition);
      const insertPrinting = database.prepare("INSERT INTO printings (id, variant_id, language, printed_code, source, source_id) VALUES (?, ?, 'en', ?, 'manual', ?)");
      for (const edition of ["first", "unlimited", "not_applicable"]) insertPrinting.run(`printing-${edition}`, `variant-${edition}`, `SYN-${edition}`, `source-${edition}`);
      const timestamp = "2026-11-06T10:00:00.000Z";
      const insertStock = database.prepare("INSERT INTO stock (id, card_id, variant_id, printing_id, language, edition, location_id, quantity, version, created_at, updated_at) VALUES (?, 'card-a', ?, ?, ?, ?, 'loc-a', ?, ?, ?, ?)");
      insertStock.run("stock-unknown", null, null, "unknown", "unknown", 7, 3, timestamp, timestamp);
      for (const [index, edition] of ["first", "unlimited", "not_applicable"].entries()) insertStock.run(`stock-${edition}`, `variant-${edition}`, `printing-${edition}`, "en", edition, index + 1, index + 4, timestamp, timestamp);
      const audit = database.prepare("INSERT INTO activity_log (id, actor_id, action, entity_type, entity_id, details_json, request_id, created_at) VALUES (?, 'user-a', ?, 'stock', ?, ?, ?, ?)");
      audit.run("audit-create", "stock.created", "stock-first", JSON.stringify({ after: { edition: "first", quantity: 1 }, note: "synthetic create" }), "request-create", timestamp);
      audit.run("audit-correct", "stock.corrected", "stock-first", JSON.stringify({ before: { edition: "first", quantity: 2 }, after: { edition: "first", quantity: 1 }, note: "synthetic correction" }), "request-correct", timestamp);
      audit.run("audit-move", "stock.moved", "stock-first", JSON.stringify({ before: { locationId: "loc-a" }, after: { locationId: "loc-a" }, movement: { quantity: 1, sourceLocationId: "loc-a", destinationLocationId: "loc-a" } }), "request-move", timestamp);
      const before = Object.fromEntries(["variants", "printings", "stock", "activity_log"].map((table) => [table, database.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));

      migrate(drizzle(database), { migrationsFolder: join(process.cwd(), "src/server/db/migrations") });
      const after = Object.fromEntries(["variants", "printings", "stock", "activity_log"].map((table) => [table, database.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
      expect(after).toEqual(before);
      expect(database.pragma("foreign_keys")).toEqual([{ foreign_keys: 1 }]);
      expect(database.pragma("foreign_key_check")).toEqual([]);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('variants_identity_unique', 'printings_source_identity_unique', 'stock_location_idx', 'stock_card_idx') ORDER BY name").all()).toEqual([
        { name: "printings_source_identity_unique" }, { name: "stock_card_idx" }, { name: "stock_location_idx" }, { name: "variants_identity_unique" },
      ]);
      expect(() => database.prepare("INSERT INTO variants (id, card_id, set_id, collector_number, edition, rarity, artwork_key) VALUES ('variant-invalid', 'card-a', 'set-a', 'BAD', 'unknown', 'Common', 'default')").run()).toThrow();
      database.prepare("INSERT INTO variants (id, card_id, set_id, collector_number, edition, rarity, artwork_key) VALUES ('variant-limited', 'card-a', 'set-a', 'SYN-L', 'limited', 'Common', 'default')").run();
      database.prepare("INSERT INTO printings (id, variant_id, language, printed_code, source, source_id) VALUES ('printing-limited', 'variant-limited', 'en', 'SYN-L', 'manual', 'source-limited')").run();
      database.prepare("INSERT INTO stock (id, card_id, variant_id, printing_id, language, edition, location_id, quantity, version, created_at, updated_at) VALUES ('stock-limited', 'card-a', 'variant-limited', 'printing-limited', 'en', 'limited', 'loc-a', 1, 1, ?, ?)").run(timestamp, timestamp);
      expect(database.pragma("foreign_key_check")).toEqual([]);
    } finally {
      database.close();
    }
  });

  it("ordnet DE- und EN-Drucke demselben Ziel zu und trennt belegte Variantenmerkmale", () => {
    const database = openMigratedDatabase();
    try {
      insertSyntheticCatalog(database);

      const insertVariant = database.prepare(
        "INSERT INTO variants (id, card_id, set_id, collector_number, edition, rarity, artwork_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      insertVariant.run(
        "fixture-variant-unlimited",
        "fixture-card-001",
        "fixture-set-001",
        "SYN-01-001",
        "unlimited",
        "synthetic-ultra",
        "fixture-artwork-a",
      );
      insertVariant.run(
        "fixture-variant-secret",
        "fixture-card-001",
        "fixture-set-001",
        "SYN-01-001",
        "first",
        "synthetic-secret",
        "fixture-artwork-a",
      );
      insertVariant.run(
        "fixture-variant-alt-art",
        "fixture-card-001",
        "fixture-set-001",
        "SYN-01-001",
        "first",
        "synthetic-ultra",
        "fixture-artwork-b",
      );

      expect(
        database
          .prepare(
            "SELECT language, variant_id FROM printings ORDER BY language",
          )
          .all(),
      ).toEqual([
        { language: "de", variant_id: "fixture-variant-001" },
        { language: "en", variant_id: "fixture-variant-001" },
      ]);
      expect(
        database
          .prepare("SELECT count(*) AS count FROM variants")
          .get(),
      ).toEqual({ count: 4 });
      expect(() =>
        insertVariant.run(
          "fixture-variant-duplicate",
          "fixture-card-001",
          "fixture-set-001",
          "SYN-01-001",
          "first",
          "synthetic-ultra",
          "fixture-artwork-a",
        ),
      ).toThrow(/UNIQUE constraint failed/);
    } finally {
      database.close();
    }
  });

  it("bindet externe IDs an ihre Quelle und schützt referenzierte Katalogdaten", () => {
    const database = openMigratedDatabase();
    try {
      insertSyntheticCatalog(database);
      const insertPrinting = database.prepare(
        "INSERT INTO printings (id, variant_id, language, printed_code, source, source_id) VALUES (?, ?, ?, ?, ?, ?)",
      );

      expect(() =>
        insertPrinting.run(
          "fixture-printing-duplicate-id",
          "fixture-variant-001",
          "fr",
          "SYN-01-FR-001",
          "synthetic-fixture",
          "fixture-source-print-de",
        ),
      ).toThrow(/UNIQUE constraint failed/);
      expect(() =>
        insertPrinting.run(
          "fixture-printing-other-source",
          "fixture-variant-001",
          "fr",
          "SYN-01-FR-001",
          "other-synthetic-fixture",
          "fixture-source-print-de",
        ),
      ).not.toThrow();

      expect(() =>
        database
          .prepare(
            "INSERT INTO variants (id, card_id, set_id, collector_number, edition, rarity, artwork_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            "fixture-orphan-variant",
            "missing-card",
            "fixture-set-001",
            "SYN-01-002",
            "first",
            "synthetic-rare",
            "fixture-artwork-a",
          ),
      ).toThrow(/FOREIGN KEY constraint failed/);
      expect(() =>
        database
          .prepare(
            "INSERT INTO variants (id, card_id, set_id, collector_number, edition, rarity, artwork_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            "fixture-orphan-set-variant",
            "fixture-card-001",
            "missing-set",
            "SYN-01-003",
            "first",
            "synthetic-rare",
            "fixture-artwork-a",
          ),
      ).toThrow(/FOREIGN KEY constraint failed/);
      expect(() =>
        insertPrinting.run(
          "fixture-orphan-printing",
          "missing-variant",
          "fr",
          "SYN-01-FR-002",
          "synthetic-fixture",
          "fixture-source-print-fr-2",
        ),
      ).toThrow(/FOREIGN KEY constraint failed/);

      for (const [table, id] of [
        ["cards", "fixture-card-001"],
        ["sets", "fixture-set-001"],
        ["variants", "fixture-variant-001"],
      ]) {
        expect(() =>
          database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id),
        ).toThrow(/FOREIGN KEY constraint failed/);
      }
      expect(
        database
          .prepare("SELECT count(*) AS count FROM printings")
          .get(),
      ).toEqual({ count: 3 });
    } finally {
      database.close();
    }
  });

  it("weist unbekannte Editionswerte und ungültige Setstatus ab", () => {
    const database = openMigratedDatabase();
    try {
      insertSyntheticCatalog(database);

      expect(() =>
        database
          .prepare(
            "INSERT INTO variants (id, card_id, set_id, collector_number, edition, rarity, artwork_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            "fixture-variant-unknown-edition",
            "fixture-card-001",
            "fixture-set-001",
            "SYN-01-002",
            "unknown",
            "synthetic-rare",
            "fixture-artwork-a",
          ),
      ).toThrow(/CHECK constraint failed/);
      expect(() =>
        database
          .prepare(
            "INSERT INTO sets (id, name, code, catalog_status) VALUES (?, ?, ?, ?)",
          )
          .run("fixture-set-invalid", "Anderes Testset", "SYN-02", "verified"),
      ).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});
