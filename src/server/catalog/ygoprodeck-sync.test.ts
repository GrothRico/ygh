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
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { syntheticCatalog } from "../db/__tests__/fixtures/catalog";
import {
  applyCatalogSnapshot,
  parseCatalogSnapshot,
  readCatalogSyncStatus,
  syncCatalog,
  type CatalogSnapshot,
} from "./ygoprodeck-sync";

vi.mock("server-only", () => ({}));

const temporaryDirectories: string[] = [];

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p202-sync-"));
  temporaryDirectories.push(directory);
  return join(directory, "catalog.sqlite");
}

function makeLegacyMigrationFolder(): string {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p202-migrations-"));
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
  const legacyEntries = journal.entries.filter((entry) => entry.idx <= 1);
  writeFileSync(
    join(metadataFolder, "_journal.json"),
    JSON.stringify({ ...journal, entries: legacyEntries }, null, 2),
  );
  for (const entry of legacyEntries) {
    copyFileSync(
      join(sourceFolder, `${entry.tag}.sql`),
      join(migrationsFolder, `${entry.tag}.sql`),
    );
  }
  return migrationsFolder;
}

function migrate(databasePath: string, migrationsFolder?: string): void {
  if (!migrationsFolder) {
    execFileSync(
      process.execPath,
      [join(process.cwd(), "node_modules/drizzle-kit/bin.cjs"), "migrate"],
      { cwd: process.cwd(), env: { ...process.env, DATABASE_PATH: databasePath }, stdio: "pipe" },
    );
    return;
  }

  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  try {
    drizzleMigrate(drizzle(database), { migrationsFolder });
  } finally {
    database.close();
  }
}

function sampleSnapshot(): CatalogSnapshot {
  return parseCatalogSnapshot(
    {
      data: [
        {
          id: 1001,
          name: "Example Dragon",
          desc: "English source text",
          card_sets: [
            { set_name: "Sample Set", set_code: "SMP-EN001", set_rarity: "Ultra Rare", set_rarity_code: "(UR)" },
            { set_name: "Sample Set", set_code: "SMP-EN001", set_rarity: "Secret Rare" },
          ],
        },
        { id: 1002, name: "Second Example", desc: "Second effect", card_sets: [] },
      ],
    },
    {
      data: [
        { id: 1001, name: "Beispieldrache", desc: "Deutscher Quelltext" },
        { id: 2001, name: "Nicht zugeordnet", desc: "Unmatched DE only" },
      ],
    },
    [
      { set_name: "Sample Set", set_code: "SMP", num_of_cards: 1, tcg_date: "2000-01-01" },
      { set_name: "Sample Set Wave 2", set_code: "SMP", num_of_cards: 1, tcg_date: "2001-01-01" },
    ],
    [{ database_version: "2026-11-02", date: "2026-11-02" }],
  );
}

function insertLegacyCatalog(database: Database.Database): void {
  const { card, set, variant, printings } = syntheticCatalog;
  database.prepare(
    "INSERT INTO cards (id, name_de, name_en, effect_de, effect_en) VALUES (?, ?, ?, ?, ?)",
  ).run(card.id, card.nameDe, card.nameEn, card.effectDe, card.effectEn);
  database.prepare(
    "INSERT INTO sets (id, name, code, catalog_status) VALUES (?, ?, ?, ?)",
  ).run(set.id, set.name, set.code, set.catalogStatus);
  database.prepare(
    "INSERT INTO variants (id, card_id, set_id, collector_number, edition, rarity, artwork_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(variant.id, variant.cardId, variant.setId, variant.collectorNumber, variant.edition, variant.rarity, variant.artworkKey);
  const insertPrinting = database.prepare(
    "INSERT INTO printings (id, variant_id, language, printed_code, source, source_id) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const printing of printings) {
    insertPrinting.run(printing.id, printing.variantId, printing.language, printing.printedCode, printing.source, printing.sourceId);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("YGOPRODeck catalog sync", () => {
  it("keeps same-code sets distinct and marks a German-only ID as a conflict", () => {
    const snapshot = sampleSnapshot();
    const databasePath = temporaryDatabasePath();
    migrate(databasePath);
    const database = new Database(databasePath);
    try {
      database.pragma("foreign_keys = ON");
      const result = applyCatalogSnapshot(database, snapshot, "2026-11-02T10:00:00.000Z");
      expect(result.conflicts).toEqual([
        { kind: "de_card_without_en", value: "2001" },
        { kind: "duplicate_set_code", value: "SMP" },
      ]);
      expect(database.prepare("SELECT code, name, catalog_status FROM sets ORDER BY name").all()).toEqual([
        { code: "SMP", name: "Sample Set", catalog_status: "partial" },
        { code: "SMP", name: "Sample Set Wave 2", catalog_status: "partial" },
      ]);
      expect(database.prepare("SELECT edition FROM variants").all()).toEqual([]);
      expect(database.prepare("SELECT count(*) AS count FROM printings").get()).toEqual({ count: 0 });
      expect(database.prepare("SELECT count(*) AS count FROM source_printing_observations").get()).toEqual({ count: 2 });
    } finally {
      database.close();
    }
  });

  it("is idempotent, updates explicit language fields, and preserves missing German data and confirmed printings", () => {
    const databasePath = temporaryDatabasePath();
    migrate(databasePath);
    const database = new Database(databasePath);
    try {
      database.pragma("foreign_keys = ON");
      insertLegacyCatalog(database);
      const snapshot = sampleSnapshot();
      const first = applyCatalogSnapshot(database, snapshot, "2026-11-02T10:00:00.000Z");
      const beforeIds = database.prepare(
        "SELECT 'card' AS kind, id FROM cards WHERE source = 'ygoprodeck' UNION ALL SELECT 'set' AS kind, id FROM sets WHERE source = 'ygoprodeck' UNION ALL SELECT 'observation' AS kind, id FROM source_printing_observations ORDER BY kind, id",
      ).all();
      database.prepare("UPDATE sets SET catalog_status = 'complete' WHERE source = 'ygoprodeck' AND source_id = ?")
        .run(JSON.stringify(["SMP", "Sample Set"]));
      const second = applyCatalogSnapshot(database, snapshot, "2026-11-02T10:01:00.000Z");
      expect(second.cardCount).toBe(first.cardCount);
      expect(database.prepare(
        "SELECT 'card' AS kind, id FROM cards WHERE source = 'ygoprodeck' UNION ALL SELECT 'set' AS kind, id FROM sets WHERE source = 'ygoprodeck' UNION ALL SELECT 'observation' AS kind, id FROM source_printing_observations ORDER BY kind, id",
      ).all()).toEqual(beforeIds);
      expect(database.prepare("SELECT catalog_status FROM sets WHERE source_id = ?").get(JSON.stringify(["SMP", "Sample Set"])))
        .toEqual({ catalog_status: "complete" });
      expect(database.prepare("SELECT count(*) AS count FROM cards WHERE source = 'ygoprodeck'").get()).toEqual({ count: 2 });
      expect(database.prepare("SELECT count(*) AS count FROM source_printing_observations").get()).toEqual({ count: 2 });

      const changedSnapshot = {
        ...snapshot,
        englishCards: snapshot.englishCards.map((card) => card.sourceId === "1001"
          ? { ...card, name: "Updated English Name", effect: "Updated effect" }
          : card),
        germanCards: snapshot.germanCards.filter((card) => card.sourceId !== "1001"),
      };
      applyCatalogSnapshot(database, changedSnapshot, "2026-11-02T10:02:00.000Z");
      expect(database.prepare("SELECT name_en, effect_en, name_de, effect_de FROM cards WHERE source_id = '1001'").get()).toEqual({
        name_en: "Updated English Name",
        effect_en: "Updated effect",
        name_de: "Beispieldrache",
        effect_de: "Deutscher Quelltext",
      });
      expect(database.prepare("SELECT id, printed_code, source_id FROM printings ORDER BY id").all()).toEqual(
        syntheticCatalog.printings.map(({ id, printedCode, sourceId }) => ({ id, printed_code: printedCode, source_id: sourceId })),
      );
    } finally {
      database.close();
    }
  });

  it("records a source HTTP error without changing catalog rows or successful conflict status", async () => {
    const databasePath = temporaryDatabasePath();
    migrate(databasePath);
    const database = new Database(databasePath);
    try {
      database.pragma("foreign_keys = ON");
      applyCatalogSnapshot(database, sampleSnapshot(), "2026-11-02T10:00:00.000Z");
      const beforeCards = database.prepare("SELECT id, source_id, name_en FROM cards ORDER BY id").all();
      const beforeStatus = readCatalogSyncStatus(database);
      vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
      await expect(syncCatalog(database, undefined, "2026-11-02T10:05:00.000Z"))
        .rejects.toMatchObject({ errorCode: "http_error" });
      expect(database.prepare("SELECT id, source_id, name_en FROM cards ORDER BY id").all()).toEqual(beforeCards);
      expect(readCatalogSyncStatus(database)).toMatchObject({
        status: "failed",
        errorCode: "http_error",
        lastAttemptAt: "2026-11-02T10:05:00.000Z",
        lastSuccessAt: "2026-11-02T10:00:00.000Z",
        databaseVersion: "2026-11-02",
        conflictCount: 2,
        conflictSummary: beforeStatus?.conflictSummary,
      });
    } finally {
      database.close();
    }
  });

  it("records invalid JSON through the source request path", async () => {
    const databasePath = temporaryDatabasePath();
    migrate(databasePath);
    const database = new Database(databasePath);
    try {
      database.pragma("foreign_keys = ON");
      vi.stubGlobal("fetch", vi.fn(async () => new Response("not json", { status: 200 })));
      await expect(syncCatalog(database, undefined, "2026-11-02T10:06:00.000Z"))
        .rejects.toMatchObject({ errorCode: "invalid_json" });
      expect(database.prepare("SELECT count(*) AS count FROM cards").get()).toEqual({ count: 0 });
      expect(readCatalogSyncStatus(database)).toMatchObject({ status: "failed", errorCode: "invalid_json" });
    } finally {
      database.close();
    }
  });

  it("keeps renamed source sets and reports the identity change on repeated imports", () => {
    const databasePath = temporaryDatabasePath();
    migrate(databasePath);
    const database = new Database(databasePath);
    try {
      database.pragma("foreign_keys = ON");
      const initial = sampleSnapshot();
      const englishIds = new Set(initial.englishCards.map((card) => card.sourceId));
      const onlyFirstSet = {
        ...initial,
        germanCards: initial.germanCards.filter((card) => englishIds.has(card.sourceId)),
        sets: [initial.sets[0]!],
      };
      expect(applyCatalogSnapshot(database, onlyFirstSet).conflicts).toEqual([]);

      const renamed = {
        ...onlyFirstSet,
        sets: [{ ...onlyFirstSet.sets[0]!, name: "Renamed Sample Set", sourceId: JSON.stringify(["SMP", "Renamed Sample Set"]) }],
      };
      const firstRename = applyCatalogSnapshot(database, renamed);
      const repeatedRename = applyCatalogSnapshot(database, renamed);
      expect(firstRename.conflicts).toEqual([{ kind: "duplicate_set_code", value: "SMP" }]);
      expect(repeatedRename.conflicts).toEqual(firstRename.conflicts);
      expect(database.prepare("SELECT code, name FROM sets WHERE code = 'SMP' ORDER BY name").all()).toEqual([
        { code: "SMP", name: "Renamed Sample Set" },
        { code: "SMP", name: "Sample Set" },
      ]);
    } finally {
      database.close();
    }
  });

  it("rejects an empty English response and contradictory duplicate card IDs before any write", () => {
    expect(() => parseCatalogSnapshot(
      { data: [] },
      { data: [] },
      [{ set_name: "Set", set_code: "SET", num_of_cards: 1, tcg_date: "2000-01-01" }],
      { database_version: "v1" },
    )).toThrow(/empty_en_card_list/);

    expect(() => parseCatalogSnapshot(
      { data: [
        { id: 1, name: "First", desc: "x" },
        { id: 1, name: "Changed", desc: "x" },
      ] },
      { data: [] },
      [{ set_name: "Set", set_code: "SET", num_of_cards: 1, tcg_date: "2000-01-01" }],
      { database_version: "v1" },
    )).toThrow(/conflicting_en_card_id/);
  });

  it("accepts one version object or a one-item version array as a defensive compatibility assumption", () => {
    const arrays = parseCatalogSnapshot(
      { data: [{ id: 1, name: "Card" }] },
      { data: [] },
      [{ set_name: "Set", set_code: "SET" }],
      [{ database_version: "v2", last_update: "2026-11-02" }],
    );
    expect(arrays.databaseDate).toBe("2026-11-02");

    const object = parseCatalogSnapshot(
      { data: [{ id: 1, name: "Card" }] },
      { data: [] },
      [{ set_name: "Set", set_code: "SET" }],
      { database_version: "v2", date: "2026-11-02" },
    );
    expect(object.databaseVersion).toBe("v2");
    expect(object.databaseDate).toBe("2026-11-02");
  });

  it("rolls back late database failures across catalog tables while preserving the last success", async () => {
    const databasePath = temporaryDatabasePath();
    migrate(databasePath);
    const database = new Database(databasePath);
    try {
      database.pragma("foreign_keys = ON");
      insertLegacyCatalog(database);
      const initial = sampleSnapshot();
      await syncCatalog(database, fetcherFor(initial), "2026-11-02T10:00:00.000Z");
      const before = {
        cards: database.prepare("SELECT id, source, source_id, name_en, name_de FROM cards ORDER BY id").all(),
        sets: database.prepare("SELECT id, source, source_id, name, code, catalog_status FROM sets ORDER BY id").all(),
        variants: database.prepare("SELECT * FROM variants ORDER BY id").all(),
        printings: database.prepare("SELECT * FROM printings ORDER BY id").all(),
        observations: database.prepare("SELECT * FROM source_printing_observations ORDER BY id").all(),
        status: readCatalogSyncStatus(database),
      };
      database.exec("CREATE TRIGGER reject_test_observation BEFORE INSERT ON source_printing_observations WHEN NEW.printed_code = 'FAIL-LATE' BEGIN SELECT RAISE(ABORT, 'synthetic late failure'); END");

      const changed: CatalogSnapshot = {
        ...initial,
        englishCards: initial.englishCards.map((card) => card.sourceId === "1001"
          ? {
            ...card,
            name: "Must Roll Back",
            observations: [...card.observations, {
              setName: "Sample Set",
              printedCode: "FAIL-LATE",
              rarity: "Common",
              rarityCode: null,
            }],
          }
          : card),
        sets: [...initial.sets, {
          code: "NEW",
          name: "Must Roll Back",
          sourceId: JSON.stringify(["NEW", "Must Roll Back"]),
        }],
      };
      await expect(syncCatalog(database, fetcherFor(changed), "2026-11-02T10:05:00.000Z"))
        .rejects.toMatchObject({ errorCode: "sync_failed" });

      expect(database.prepare("SELECT id, source, source_id, name_en, name_de FROM cards ORDER BY id").all()).toEqual(before.cards);
      expect(database.prepare("SELECT id, source, source_id, name, code, catalog_status FROM sets ORDER BY id").all()).toEqual(before.sets);
      expect(database.prepare("SELECT * FROM variants ORDER BY id").all()).toEqual(before.variants);
      expect(database.prepare("SELECT * FROM printings ORDER BY id").all()).toEqual(before.printings);
      expect(database.prepare("SELECT * FROM source_printing_observations ORDER BY id").all()).toEqual(before.observations);
      expect(readCatalogSyncStatus(database)).toMatchObject({
        status: "failed",
        lastSuccessAt: "2026-11-02T10:00:00.000Z",
        conflictCount: before.status?.conflictCount,
        conflictSummary: before.status?.conflictSummary,
      });
    } finally {
      database.close();
    }
  });

  it("upgrades an existing P2-01 catalog without losing confirmed rows and enforces source identity pairs", () => {
    const databasePath = temporaryDatabasePath();
    migrate(databasePath, makeLegacyMigrationFolder());
    const legacy = new Database(databasePath);
    legacy.pragma("foreign_keys = ON");
    insertLegacyCatalog(legacy);
    legacy.close();

    migrate(databasePath);
    const upgraded = new Database(databasePath);
    try {
      expect(upgraded.prepare("SELECT id, source, source_id FROM cards WHERE id = ?").get(syntheticCatalog.card.id)).toEqual({
        id: syntheticCatalog.card.id,
        source: null,
        source_id: null,
      });
      expect(upgraded.prepare("SELECT id, variant_id, printed_code FROM printings ORDER BY id").all()).toHaveLength(2);
      expect(() => upgraded.prepare(
        "INSERT INTO cards (id, source, source_id, name_en) VALUES (?, ?, NULL, ?)",
      ).run("invalid-source-pair", "ygoprodeck", "Invalid")).toThrow(/CHECK constraint failed/);
    } finally {
      upgraded.close();
    }
  });
});

function fetcherFor(snapshot: CatalogSnapshot): (url: string) => Promise<unknown> {
  return async (url) => {
    if (url.endsWith("cardinfo.php?language=de")) {
      return {
        data: snapshot.germanCards.map((card) => ({
          id: card.sourceId,
          name: card.name,
          desc: card.effect,
        })),
      };
    }
    if (url.endsWith("cardinfo.php")) {
      return {
        data: snapshot.englishCards.map((card) => ({
          id: card.sourceId,
          name: card.name,
          desc: card.effect,
          card_sets: card.observations.map((observation) => ({
            set_name: observation.setName,
            set_code: observation.printedCode,
            set_rarity: observation.rarity,
            set_rarity_code: observation.rarityCode,
          })),
        })),
      };
    }
    if (url.endsWith("cardsets.php")) {
      return snapshot.sets.map((set) => ({ set_code: set.code, set_name: set.name }));
    }
    return [{ database_version: snapshot.databaseVersion, last_update: snapshot.databaseDate }];
  };
}
