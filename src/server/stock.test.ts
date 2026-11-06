import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Worker } from "node:worker_threads";
import ts from "typescript";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { syntheticCatalog } from "./db/__tests__/fixtures/catalog";
import { createLocation, deleteLocation, listLocations } from "./locations";
import { correctStock, listStock, listStockActivity, moveStock, moveStocks, recordStock, StockError, type StockInput } from "./stock";
import { StockManager } from "../app/bestand/StockManager";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const dirs: string[] = [];
function migrationsThroughFour() {
  const dir = mkdtempSync(join(tmpdir(), "ygh-p205-migrations-")); dirs.push(dir);
  const source = join(process.cwd(), "src/server/db/migrations");
  const target = join(dir, "migrations"); const meta = join(target, "meta"); mkdirSync(meta, { recursive: true });
  const journal = JSON.parse(readFileSync(join(source, "meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  const entries = journal.entries.filter((entry) => entry.idx <= 4);
  writeFileSync(join(meta, "_journal.json"), JSON.stringify({ version: "7", dialect: "sqlite", entries }, null, 2));
  for (const entry of entries) copyFileSync(join(source, `${entry.tag}.sql`), join(target, `${entry.tag}.sql`));
  return target;
}
function migrationsThroughSeven() {
  const dir = mkdtempSync(join(tmpdir(), "ygh-p206-migrations-")); dirs.push(dir);
  const source = join(process.cwd(), "src/server/db/migrations");
  const target = join(dir, "migrations"); const meta = join(target, "meta"); mkdirSync(meta, { recursive: true });
  const journal = JSON.parse(readFileSync(join(source, "meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  const entries = journal.entries.filter((entry) => entry.idx <= 7);
  writeFileSync(join(meta, "_journal.json"), JSON.stringify({ version: "7", dialect: "sqlite", entries }, null, 2));
  for (const entry of entries) copyFileSync(join(source, `${entry.tag}.sql`), join(target, `${entry.tag}.sql`));
  return target;
}
function createDb() {

  const dir = mkdtempSync(join(tmpdir(), "ygh-p205-")); dirs.push(dir);
  const databasePath = join(dir, "test.sqlite");
  execFileSync(process.execPath, [join(process.cwd(), "node_modules/drizzle-kit/bin.cjs"), "migrate"], { cwd: process.cwd(), env: { ...process.env, DATABASE_PATH: databasePath }, stdio: "pipe" });
  const db = new Database(databasePath); db.pragma("foreign_keys = ON");
  db.prepare("INSERT INTO users (id, identity_subject, display_name, active) VALUES ('user-a', 'a@example.invalid', 'Person A', 1)").run();
  db.prepare("INSERT INTO users (id, identity_subject, display_name, active) VALUES ('user-b', 'b@example.invalid', 'Person B', 1)").run();
  db.prepare("INSERT INTO cards (id, name_de, name_en) VALUES (?, ?, ?)").run(syntheticCatalog.card.id, syntheticCatalog.card.nameDe, syntheticCatalog.card.nameEn);
  db.prepare("INSERT INTO sets (id, name, code) VALUES (?, ?, ?)").run(syntheticCatalog.set.id, syntheticCatalog.set.name, syntheticCatalog.set.code);
  db.prepare("INSERT INTO variants (id, card_id, set_id, collector_number, edition, rarity, artwork_key) VALUES (?, ?, ?, ?, ?, ?, ?)").run(syntheticCatalog.variant.id, syntheticCatalog.variant.cardId, syntheticCatalog.variant.setId, syntheticCatalog.variant.collectorNumber, syntheticCatalog.variant.edition, syntheticCatalog.variant.rarity, syntheticCatalog.variant.artworkKey);
  const printing = db.prepare("INSERT INTO printings (id, variant_id, language, printed_code, source, source_id) VALUES (?, ?, ?, ?, ?, ?)");
  for (const item of syntheticCatalog.printings) printing.run(item.id, item.variantId, item.language, item.printedCode, item.source, item.sourceId);
  db.close();
  const location = listLocations(databasePath).find((row) => row.kind === "unknown")!;
  return { databasePath, locationId: location.id };
}
function input(locationId: string, values: Partial<StockInput> = {}): StockInput {
  return { cardId: syntheticCatalog.card.id, variantId: null, printingId: null, sourceObservationId: null, language: "unknown", edition: "unknown", locationId, quantity: 1, ...values };
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("P2-05 Bestand", () => {
  it("migriert den Audit-Constraint vorwärts, erhält bestehende Einträge und lässt Fremdschlüssel aktiv", () => {
    const dir = mkdtempSync(join(tmpdir(), "ygh-p206-legacy-")); dirs.push(dir); const databasePath = join(dir, "legacy.sqlite");
    const legacy = new Database(databasePath);
    try {
      drizzleMigrate(drizzle(legacy), { migrationsFolder: migrationsThroughSeven() });
      legacy.pragma("foreign_keys = ON");
      legacy.prepare("INSERT INTO users (id, identity_subject, display_name, active) VALUES ('legacy-user', 'legacy@example.invalid', 'Legacy', 1)").run();
      legacy.prepare("INSERT INTO cards (id, name_en) VALUES ('legacy-card', 'Legacy card')").run();
      legacy.prepare("INSERT INTO locations (id, name, kind) VALUES ('legacy-location', 'Legacy location', 'folder')").run();
      legacy.prepare("INSERT INTO activity_log (id, actor_id, action, entity_type, entity_id, details_json, request_id, created_at) VALUES ('legacy-audit', 'legacy-user', 'stock.created', 'stock', 'legacy-stock', '{\"after\":{\"quantity\":1}}', 'legacy-request', '2026-11-03T00:00:00.000Z')").run();
      drizzleMigrate(drizzle(legacy), { migrationsFolder: join(process.cwd(), "src/server/db/migrations") });
      expect(legacy.pragma("foreign_keys")).toEqual([{ foreign_keys: 1 }]);
      expect(legacy.prepare("SELECT id, actor_id, action, details_json, request_id FROM activity_log WHERE id = 'legacy-audit'").get()).toEqual({ id: "legacy-audit", actor_id: "legacy-user", action: "stock.created", details_json: '{"after":{"quantity":1}}', request_id: "legacy-request" });
      expect(legacy.pragma("foreign_key_check")).toEqual([]);
      expect(() => legacy.prepare("INSERT INTO activity_log (id, actor_id, action, entity_type, entity_id, details_json, request_id, created_at) VALUES ('movement-audit', 'legacy-user', 'stock.moved', 'stock', 'legacy-stock', '{\"after\":{\"quantity\":1}}', 'movement-request', '2026-11-03T00:00:01.000Z')").run()).not.toThrow();
      expect(() => legacy.prepare("INSERT INTO activity_log (id, actor_id, action, entity_type, entity_id, details_json, request_id, created_at) VALUES ('bad-audit', 'legacy-user', 'stock.deleted', 'stock', 'legacy-stock', '{\"after\":{}}', 'bad-request', '2026-11-03T00:00:02.000Z')").run()).toThrow();
      expect(() => legacy.prepare("INSERT INTO activity_log (id, actor_id, action, entity_type, entity_id, details_json, request_id, created_at) VALUES ('orphan-audit', 'missing-user', 'stock.moved', 'stock', 'legacy-stock', '{\"after\":{}}', 'orphan-request', '2026-11-03T00:00:03.000Z')").run()).toThrow();
    } finally { legacy.close(); }
  });
  it("migriert additiv, erhält vorhandene Benutzer, Katalogdaten und Standorte", () => {
    const dir = mkdtempSync(join(tmpdir(), "ygh-p205-legacy-")); dirs.push(dir); const databasePath = join(dir, "legacy.sqlite");
    const legacy = new Database(databasePath); legacy.pragma("foreign_keys = ON");
    try {
      drizzleMigrate(drizzle(legacy), { migrationsFolder: migrationsThroughFour() });
      legacy.prepare("INSERT INTO users (id, identity_subject, display_name, active) VALUES ('existing-user', 'existing@example.invalid', 'Vorhanden', 1)").run();
      legacy.prepare("INSERT INTO cards (id, name_en) VALUES ('existing-card', 'Saved card')").run();
      legacy.prepare("INSERT INTO sets (id, name, code) VALUES ('existing-set', 'Saved set', 'SAVED')").run();
      legacy.prepare("INSERT INTO locations (id, name, kind, parent_id, person_id) VALUES ('existing-location', 'Existing box', 'person', NULL, 'existing-user')").run();
    } finally { legacy.close(); }
    execFileSync(process.execPath, [join(process.cwd(), "node_modules/drizzle-kit/bin.cjs"), "migrate"], { cwd: process.cwd(), env: { ...process.env, DATABASE_PATH: databasePath }, stdio: "pipe" });
    const upgraded = new Database(databasePath);
    try {
      expect(upgraded.prepare("SELECT display_name FROM users WHERE id = 'existing-user'").get()).toEqual({ display_name: "Vorhanden" });
      expect(upgraded.prepare("SELECT name_en FROM cards WHERE id = 'existing-card'").get()).toEqual({ name_en: "Saved card" });
      expect(upgraded.prepare("SELECT name FROM sets WHERE id = 'existing-set'").get()).toEqual({ name: "Saved set" });
      expect(upgraded.prepare("SELECT name, kind, parent_id FROM locations WHERE id = 'existing-location'").get()).toEqual({ name: "Existing box", kind: "folder", parent_id: null });
      expect(upgraded.prepare("SELECT COUNT(*) AS count FROM stock").get()).toEqual({ count: 0 });
      expect(upgraded.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { upgraded.close(); }
  });
  it("fasst DE und EN derselben bestätigten Variante zusammen und lässt Editionen getrennt", () => {
    const { databasePath, locationId } = createDb();
    recordStock(databasePath, input(locationId, { variantId: "fixture-variant-001", printingId: "fixture-printing-de", language: "de", edition: "first", quantity: 1 }), "user-a", "request-a");
    recordStock(databasePath, input(locationId, { variantId: "fixture-variant-001", printingId: "fixture-printing-en", language: "en", edition: "first", quantity: 1 }), "user-b", "request-b");
    recordStock(databasePath, input(locationId, { edition: "unlimited", quantity: 2 }), "user-a", "request-c");
    const groups = listStock(databasePath);
    expect(groups.find((group) => group.edition === "first")).toMatchObject({ total: 2, languageCounts: { de: 1, en: 1, unknown: 0 } });
    expect(groups.find((group) => group.edition === "unlimited")?.total).toBe(2);
  });
  it("filtert frei benannte Ordner einschließlich aller Unterstandorte vor Gruppierung", () => {
    const { databasePath, locationId } = createDb();
    const locations = listLocations(databasePath);
    const unknown = locations.find((row) => row.kind === "unknown")!;
    const box = createLocation(databasePath, "Kartenordner", locationId);
    const nested = createLocation(databasePath, "Unterordner", box);
    const otherFolder = createLocation(databasePath, "Anderer Ordner", null);
    recordStock(databasePath, input(locationId, { quantity: 2 }), "user-a", "request-a");
    recordStock(databasePath, input(box), "user-a", "request-b");
    recordStock(databasePath, input(nested), "user-a", "request-c");
    recordStock(databasePath, input(otherFolder), "user-b", "request-d");
    recordStock(databasePath, input(unknown.id), "user-a", "request-e");
    expect(listStock(databasePath, 25, 0, locationId).map((group) => group.locationId).sort()).toEqual([locationId, box, nested].sort());
    expect(listStock(databasePath, 25, 0, box).map((group) => group.locationId).sort()).toEqual([box, nested].sort());
    expect(listStock(databasePath, 25, 0, unknown.id).map((group) => group.locationId).sort()).toEqual([locationId, box, nested].sort());
    expect(listStock(databasePath, 25, 0, otherFolder).map((group) => group.locationId)).toEqual([otherFolder]);
  });
  it("blättert 15.000 Gruppen in SQLite stabil und lädt Details nur für die ausgewählte Seite", () => {
    const { databasePath } = createDb();
    const db = new Database(databasePath);
    const locationId = listLocations(databasePath).find((row) => row.kind === "unknown")!.id;
    try {
      const insertCard = db.prepare("INSERT INTO cards (id, name_de, source, source_id) VALUES (?, ?, 'ygoprodeck', ?)");
      const insertStock = db.prepare("INSERT INTO stock (id, card_id, language, edition, location_id, quantity, version, created_at, updated_at) VALUES (?, ?, ?, 'unknown', ?, 1, 1, '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z')");
      db.transaction(() => {
        for (let index = 0; index < 15_000; index += 1) {
          const id = `page-card-${String(index).padStart(5, "0")}`;
          insertCard.run(id, `Karte ${String(index).padStart(5, "0")}`, String(index + 1));
          insertStock.run(`page-stock-${index}`, id, index % 2 === 0 ? "de" : "en", locationId);
        }
      })();
    } finally { db.close(); }

    const first = listStock(databasePath, 25, 0);
    const second = listStock(databasePath, 25, 25);
    expect(first).toHaveLength(26);
    expect(first.slice(0, 25).every((group) => group.rows.length === 1 && group.cardImageId !== null)).toBe(true);
    expect(first[25]?.rows).toEqual([]);
    expect(second).toHaveLength(26);
    const firstKeys = new Set(first.slice(0, 25).map((group) => group.key));
    expect(second.slice(0, 25).some((group) => firstKeys.has(group.key))).toBe(false);
    expect(first[0]?.cardName).toBe("Karte 00000");
    expect(second[0]?.cardName).toBe("Karte 00025");
    expect(first.slice(0, 25).reduce((total, group) => total + group.total, 0)).toBe(25);
    expect(first.slice(0, 25).reduce((total, group) => total + group.languageCounts.de + group.languageCounts.en + group.languageCounts.unknown, 0)).toBe(25);
    const html = renderToStaticMarkup(createElement(StockManager, {
      groups: first.slice(0, 25), hasNextPage: true, page: 0, locations: listLocations(databasePath), choicesByCard: {}, cardId: null, cardName: null,
      cardNameEn: null, activityByStock: {}, locationId: null, invalidLocation: false,
    }));
    expect(html.match(/src="\/api\/cards\/[^\"]+\/image"/g)).toHaveLength(25);
  });
  it("lehnt ungültige Mengen und widersprüchliche Referenzen ab", () => {
    const { databasePath, locationId } = createDb();
    for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => recordStock(databasePath, input(locationId, { quantity }), "user-a", "request")).toThrow(StockError);
    }
    expect(() => recordStock(databasePath, input(locationId, { cardId: "missing" }), "user-a", "request")).toThrowError(expect.objectContaining({ code: "card_missing" }));
    expect(() => recordStock(databasePath, input(locationId, { variantId: "fixture-variant-001", edition: "unlimited" }), "user-a", "request")).toThrowError(expect.objectContaining({ code: "variant_mismatch" }));
    expect(() => recordStock(databasePath, input(locationId, { variantId: "fixture-variant-001", printingId: "fixture-printing-en", language: "de", edition: "first" }), "user-a", "request")).toThrowError(expect.objectContaining({ code: "printing_mismatch" }));
  });
  it("bewahrt unterschiedliche unbestätigte Druckbeobachtungen getrennt und prüft ihre Karte", () => {
    const { databasePath, locationId } = createDb(); const db = new Database(databasePath);
    try {
      db.prepare("INSERT INTO cards (id, name_en) VALUES ('other-card', 'Other synthetic card')").run();
      const insert = db.prepare("INSERT INTO source_printing_observations (id, card_id, source, card_source_id, set_name, printed_code, rarity) VALUES (?, ?, 'synthetic', '1', ?, ?, ?)");
      insert.run("obs-a", syntheticCatalog.card.id, "Beobachtetes Set A", "OBS-A", "Rare");
      insert.run("obs-b", syntheticCatalog.card.id, "Beobachtetes Set B", "OBS-B", "Ultra Rare");
      insert.run("obs-other-card", "other-card", "Andere Karte", "OTHER", "Rare");
    } finally { db.close(); }
    expect(() => recordStock(databasePath, input(locationId, { sourceObservationId: "obs-other-card" }), "user-a", "request")).toThrowError(expect.objectContaining({ code: "observation_mismatch" }));
    recordStock(databasePath, input(locationId, { sourceObservationId: "obs-a" }), "user-a", "request-a");
    recordStock(databasePath, input(locationId, { sourceObservationId: "obs-b" }), "user-a", "request-b");
    expect(listStock(databasePath)).toHaveLength(2);
  });
  it("bewahrt manuelle Edition ohne bestätigte Variante und erstellt keinen Katalogeintrag", () => {
    const { databasePath, locationId } = createDb();
    const id = recordStock(databasePath, input(locationId, { edition: "unlimited" }), "user-a", "request");
    const db = new Database(databasePath);
    try {
      expect(db.prepare("SELECT edition, variant_id FROM stock WHERE id = ?").get(id)).toEqual({ edition: "unlimited", variant_id: null });
      expect(db.prepare("SELECT COUNT(*) AS count FROM variants").get()).toEqual({ count: 1 });
    } finally { db.close(); }
  });
  it("schreibt Korrektur und Verlauf atomar, sperrt veraltete Version und verhindert Orts-/Kartenwechsel", () => {
    const { databasePath, locationId } = createDb();
    const id = recordStock(databasePath, input(locationId), "user-a", "request-a");
    correctStock(databasePath, id, 1, input(locationId, { language: "de", edition: "unlimited", quantity: 3 }), "user-b", "request-b");
    expect(() => correctStock(databasePath, id, 1, input(locationId), "user-a", "request-c")).toThrowError(expect.objectContaining({ code: "stale_version" }));
    expect(() => correctStock(databasePath, id, 2, input("other-location"), "user-a", "request-d")).toThrow(StockError);
    const db = new Database(databasePath);
    try {
      db.exec("CREATE TRIGGER fail_stock_audit BEFORE INSERT ON activity_log WHEN NEW.action = 'stock.corrected' BEGIN SELECT RAISE(ABORT, 'audit failed'); END");
      expect(() => correctStock(databasePath, id, 2, input(locationId, { quantity: 4 }), "user-a", "request-e")).toThrow(/audit failed/);
      expect(db.prepare("SELECT quantity, version FROM stock WHERE id = ?").get(id)).toEqual({ quantity: 3, version: 2 });
      expect(db.prepare("SELECT COUNT(*) AS count FROM activity_log WHERE entity_id = ?").get(id)).toEqual({ count: 2 });
    } finally { db.close(); }
  });
  it("verschiebt eine Teilmenge mit Referenzen und Sprache in zwei unterscheidbare Bestandszeilen", () => {
    const { databasePath, locationId } = createDb();
    const destinationId = createLocation(databasePath, "Zielordner", null);
    const sourceId = recordStock(databasePath, input(locationId, { variantId: "fixture-variant-001", printingId: "fixture-printing-de", language: "de", edition: "first", quantity: 5 }), "user-a", "request-create");
    const existingTargetId = recordStock(databasePath, input(destinationId, { variantId: "fixture-variant-001", printingId: "fixture-printing-en", language: "en", edition: "first", quantity: 7 }), "user-a", "request-target");
    moveStock(databasePath, sourceId, 1, destinationId, 2, "user-b", "request-move");
    const db = new Database(databasePath);
    try {
      const source = db.prepare("SELECT id, quantity, version, location_id, variant_id, printing_id, language, edition FROM stock WHERE id = ?").get(sourceId);
      const target = db.prepare("SELECT id, quantity, version, location_id, variant_id, printing_id, language, edition FROM stock WHERE id != ? AND id != ? AND location_id = ?").get(sourceId, existingTargetId, destinationId);
      expect(source).toMatchObject({ id: sourceId, quantity: 3, version: 2, location_id: locationId, variant_id: "fixture-variant-001", printing_id: "fixture-printing-de", language: "de", edition: "first" });
      expect(target).toMatchObject({ quantity: 2, version: 1, location_id: destinationId, variant_id: "fixture-variant-001", printing_id: "fixture-printing-de", language: "de", edition: "first" });
      expect((target as { id: string }).id).not.toBe(existingTargetId);
      expect(db.prepare("SELECT id, quantity, language FROM stock WHERE id = ?").get(existingTargetId)).toEqual({ id: existingTargetId, quantity: 7, language: "en" });
      const audits = db.prepare("SELECT entity_id, actor_id, action, request_id, details_json FROM activity_log WHERE request_id = 'request-move' ORDER BY entity_id").all() as { entity_id: string; actor_id: string; action: string; request_id: string; details_json: string }[];
      expect(audits).toHaveLength(2);
      for (const audit of audits) expect(audit).toMatchObject({ actor_id: "user-b", action: "stock.moved", request_id: "request-move" });
      expect(JSON.parse(audits.find((row) => row.entity_id === sourceId)!.details_json)).toMatchObject({
        before: { quantity: 5, locationId, language: "de", printingId: "fixture-printing-de" },
        after: { quantity: 3, locationId, language: "de", printingId: "fixture-printing-de" },
        movement: { sourceStockId: sourceId, sourceLocationId: locationId, destinationLocationId: destinationId, quantity: 2 },
      });
      expect(listStockActivity(databasePath, sourceId)[0]).toMatchObject({ action: "stock.moved", actorName: "Person B", movement: { quantity: 2, sourcePath: "Ungeklärt", destinationPath: "Zielordner" } });
      expect(listStock(databasePath).reduce((sum, group) => sum + group.total, 0)).toBe(12);
    } finally { db.close(); }
  });
  it("vollverschiebt dieselbe Zeile samt ID und schreibt Vorher/Nachher ohne Nullbestand", () => {
    const { databasePath, locationId } = createDb(); const destinationId = createLocation(databasePath, "Ziel", null);
    const id = recordStock(databasePath, input(locationId, { quantity: 4 }), "user-a", "request-create");
    moveStock(databasePath, id, 1, destinationId, 4, "user-b", "request-full-move");
    const db = new Database(databasePath);
    try {
      expect(db.prepare("SELECT id, quantity, version, location_id FROM stock WHERE id = ?").get(id)).toEqual({ id, quantity: 4, version: 2, location_id: destinationId });
      expect(db.prepare("SELECT COUNT(*) AS count FROM stock WHERE quantity <= 0").get()).toEqual({ count: 0 });
      const entry = db.prepare("SELECT entity_id, actor_id, action, request_id, details_json FROM activity_log WHERE request_id = 'request-full-move'").get() as { entity_id: string; actor_id: string; action: string; request_id: string; details_json: string };
      expect(entry).toMatchObject({ entity_id: id, actor_id: "user-b", action: "stock.moved", request_id: "request-full-move" });
      expect(JSON.parse(entry.details_json)).toMatchObject({ before: { quantity: 4, locationId }, after: { quantity: 4, locationId: destinationId }, movement: { sourceStockId: id, targetStockId: id, quantity: 4 } });
    } finally { db.close(); }
  });
  it("lehnt ungültige, zu große, veraltete, gleichörtliche und nicht vorhandene Verschiebungen ohne Schreiben ab", () => {
    const { databasePath, locationId } = createDb(); const destinationId = createLocation(databasePath, "Ziel", null);
    const id = recordStock(databasePath, input(locationId, { quantity: 1 }), "user-a", "request-create");
    for (const quantity of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => moveStock(databasePath, id, 1, destinationId, quantity, "user-a", "request-invalid")).toThrowError(expect.objectContaining({ code: "invalid_move_quantity" }));
    }
    expect(() => moveStock(databasePath, id, 1, destinationId, 2, "user-a", "request-invalid")).toThrowError(expect.objectContaining({ code: "move_quantity_exceeds_stock" }));
    expect(() => moveStock(databasePath, id, 1, locationId, 1, "user-a", "request-invalid")).toThrowError(expect.objectContaining({ code: "same_location" }));
    expect(() => moveStock(databasePath, id, 1, "missing-location", 1, "user-a", "request-invalid")).toThrowError(expect.objectContaining({ code: "location_missing" }));
    expect(() => moveStock(databasePath, "missing-stock", 1, destinationId, 1, "user-a", "request-invalid")).toThrowError(expect.objectContaining({ code: "stock_missing" }));
    moveStock(databasePath, id, 1, destinationId, 1, "user-a", "request-first");
    expect(() => moveStock(databasePath, id, 1, locationId, 1, "user-a", "request-stale")).toThrowError(expect.objectContaining({ code: "stale_version" }));
    const db = new Database(databasePath);
    try { expect(db.prepare("SELECT COUNT(*) AS count FROM activity_log WHERE request_id LIKE 'request-invalid%' OR request_id = 'request-stale'").get()).toEqual({ count: 0 }); } finally { db.close(); }
  });
  it("rollt Quellen-, Zielzeile und ersten Verlaufseintrag zurück, wenn der zweite Verlaufseintrag scheitert", () => {
    const { databasePath, locationId } = createDb(); const destinationId = createLocation(databasePath, "Ziel", null);
    const id = recordStock(databasePath, input(locationId, { quantity: 5 }), "user-a", "request-create");
    const db = new Database(databasePath);
    try { db.exec("CREATE TRIGGER fail_second_move_audit BEFORE INSERT ON activity_log WHEN NEW.action = 'stock.moved' AND NEW.entity_id != '" + id + "' BEGIN SELECT RAISE(ABORT, 'second audit failed'); END"); } finally { db.close(); }
    expect(() => moveStock(databasePath, id, 1, destinationId, 2, "user-a", "request-fail")).toThrow(/second audit failed/);
    const verify = new Database(databasePath);
    try {
      expect(verify.prepare("SELECT id, quantity, version, location_id FROM stock").all()).toEqual([{ id, quantity: 5, version: 1, location_id: locationId }]);
      expect(verify.prepare("SELECT COUNT(*) AS count FROM activity_log WHERE request_id = 'request-fail'").get()).toEqual({ count: 0 });
    } finally { verify.close(); }
  });
  it("rollt ein Vollverschieben bei fehlgeschlagenem Verlauf vollständig zurück", () => {
    const { databasePath, locationId } = createDb(); const destinationId = createLocation(databasePath, "Ziel", null);
    const id = recordStock(databasePath, input(locationId, { quantity: 3 }), "user-a", "request-create");
    const db = new Database(databasePath);
    try { db.exec("CREATE TRIGGER fail_full_move_audit BEFORE INSERT ON activity_log WHEN NEW.action = 'stock.moved' BEGIN SELECT RAISE(ABORT, 'full audit failed'); END"); } finally { db.close(); }
    expect(() => moveStock(databasePath, id, 1, destinationId, 3, "user-a", "request-full-fail")).toThrow(/full audit failed/);
    const verify = new Database(databasePath);
    try {
      expect(verify.prepare("SELECT id, quantity, version, location_id FROM stock").all()).toEqual([{ id, quantity: 3, version: 1, location_id: locationId }]);
      expect(verify.prepare("SELECT COUNT(*) AS count FROM activity_log WHERE request_id = 'request-full-fail'").get()).toEqual({ count: 0 });
    } finally { verify.close(); }
  });
  it("verschiebt mehrere Karten samt Teil- und Vollmengen in einem gemeinsamen Vorgang", () => {
    const { databasePath, locationId } = createDb(); const destinationId = createLocation(databasePath, "Ziel", null);
    const db = new Database(databasePath);
    try { db.prepare("INSERT INTO cards (id, name_en) VALUES ('card-b', 'Second synthetic card')").run(); } finally { db.close(); }
    const firstId = recordStock(databasePath, input(locationId, { variantId: "fixture-variant-001", printingId: "fixture-printing-de", language: "de", edition: "first", quantity: 5 }), "user-a", "create-first");
    const secondId = recordStock(databasePath, input(locationId, { cardId: "card-b", language: "en", quantity: 4 }), "user-a", "create-second");
    moveStocks(databasePath, [{ id: firstId, expectedVersion: 1, quantity: 2 }, { id: secondId, expectedVersion: 1, quantity: 4 }], destinationId, "user-b", "bulk-move");
    const verify = new Database(databasePath);
    try {
      expect(verify.prepare("SELECT id, quantity, version, location_id FROM stock WHERE id = ?").get(firstId)).toEqual({ id: firstId, quantity: 3, version: 2, location_id: locationId });
      expect(verify.prepare("SELECT id, quantity, version, location_id FROM stock WHERE id = ?").get(secondId)).toEqual({ id: secondId, quantity: 4, version: 2, location_id: destinationId });
      expect(verify.prepare("SELECT card_id, quantity, language, location_id FROM stock WHERE id NOT IN (?, ?) ORDER BY card_id").all(firstId, secondId)).toEqual([
        { card_id: syntheticCatalog.card.id, quantity: 2, language: "de", location_id: destinationId },
      ]);
      expect(verify.prepare("SELECT action, actor_id, request_id, COUNT(*) AS count FROM activity_log WHERE request_id = 'bulk-move' GROUP BY action, actor_id, request_id").get()).toEqual({ action: "stock.moved", actor_id: "user-b", request_id: "bulk-move", count: 3 });
    } finally { verify.close(); }
  });
  it("weist leere, doppelte und ungültige Mehrfachbewegungen ab und rollt späte Versions-/Auditfehler vollständig zurück", () => {
    const { databasePath, locationId } = createDb(); const destinationId = createLocation(databasePath, "Ziel", null);
    const db = new Database(databasePath);
    try { db.prepare("INSERT INTO cards (id, name_en) VALUES ('card-b', 'Second synthetic card')").run(); } finally { db.close(); }
    const firstId = recordStock(databasePath, input(locationId, { quantity: 5 }), "user-a", "create-first");
    const secondId = recordStock(databasePath, input(locationId, { cardId: "card-b", quantity: 4 }), "user-a", "create-second");
    expect(() => moveStocks(databasePath, [], destinationId, "user-a", "empty")).toThrowError(expect.objectContaining({ code: "invalid_input" }));
    expect(() => moveStocks(databasePath, [{ id: firstId, expectedVersion: 1, quantity: 1 }, { id: firstId, expectedVersion: 1, quantity: 1 }], destinationId, "user-a", "duplicate")).toThrowError(expect.objectContaining({ code: "invalid_input" }));
    expect(() => moveStocks(databasePath, [{ id: firstId, expectedVersion: 1, quantity: 1 }, { id: secondId, expectedVersion: 2, quantity: 1 }], destinationId, "user-a", "late-stale")).toThrowError(expect.objectContaining({ code: "stale_version" }));
    const beforeAuditFailure = new Database(databasePath);
    try { beforeAuditFailure.exec(`CREATE TRIGGER fail_late_bulk_audit BEFORE INSERT ON activity_log WHEN NEW.action = 'stock.moved' AND NEW.entity_id = '${secondId}' BEGIN SELECT RAISE(ABORT, 'late bulk audit failed'); END`); } finally { beforeAuditFailure.close(); }
    expect(() => moveStocks(databasePath, [{ id: firstId, expectedVersion: 1, quantity: 2 }, { id: secondId, expectedVersion: 1, quantity: 2 }], destinationId, "user-a", "late-audit")).toThrow(/late bulk audit failed/);
    const verify = new Database(databasePath);
    try {
      expect(verify.prepare("SELECT id, quantity, version, location_id FROM stock ORDER BY id").all()).toEqual([
        { id: firstId, quantity: 5, version: 1, location_id: locationId },
        { id: secondId, quantity: 4, version: 1, location_id: locationId },
      ].sort((left, right) => left.id.localeCompare(right.id)));
      expect(verify.prepare("SELECT COUNT(*) AS count FROM activity_log WHERE request_id IN ('empty', 'duplicate', 'late-stale', 'late-audit')").get()).toEqual({ count: 0 });
    } finally { verify.close(); }
  });
  it("lässt zwei gleichzeitige Worker mit eigenen DB-Verbindungen nicht dieselbe letzte Kopie verschieben", async () => {
    const { databasePath, locationId } = createDb(); const firstTarget = createLocation(databasePath, "Ziel A", null); const secondTarget = createLocation(databasePath, "Ziel B", null);
    const id = recordStock(databasePath, input(locationId, { quantity: 1 }), "user-a", "request-create");
    const runtimeRoot = mkdtempSync(join(tmpdir(), "ygh-p206-workers-")); dirs.push(runtimeRoot);
    const sources = [
      ["stock.js", join(process.cwd(), "src/server/stock.ts")],
      ["db/index.js", join(process.cwd(), "src/server/db/index.ts")],
      ["db/schema.js", join(process.cwd(), "src/server/db/schema.ts")],
    ] as const;
    for (const [outputPath, sourcePath] of sources) {
      const output = ts.transpileModule(readFileSync(sourcePath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
      const targetPath = join(runtimeRoot, outputPath); mkdirSync(join(targetPath, ".."), { recursive: true }); writeFileSync(targetPath, output);
    }
    symlinkSync(join(process.cwd(), "node_modules"), join(runtimeRoot, "node_modules"), "dir");
    const workerPath = join(runtimeRoot, "worker.cjs");
    writeFileSync(workerPath, `const { parentPort, workerData } = require("node:worker_threads");
const { moveStock } = require(workerData.stockPath);
parentPort.postMessage({ type: "ready" });
parentPort.once("message", () => {
  try { moveStock(workerData.databasePath, workerData.id, 1, workerData.destinationId, 1, workerData.actorId, workerData.requestId); parentPort.postMessage({ type: "result", ok: true }); }
  catch (error) { parentPort.postMessage({ type: "result", ok: false, code: error.code }); }
});`);
    const workers = [
      new Worker(workerPath, { workerData: { stockPath: join(runtimeRoot, "stock.js"), databasePath, id, destinationId: firstTarget, actorId: "user-a", requestId: "request-race-a" }, execArgv: ["--conditions=react-server"] }),
      new Worker(workerPath, { workerData: { stockPath: join(runtimeRoot, "stock.js"), databasePath, id, destinationId: secondTarget, actorId: "user-b", requestId: "request-race-b" }, execArgv: ["--conditions=react-server"] }),
    ];
    try {
      await Promise.all(workers.map((worker) => new Promise<void>((resolve, reject) => { worker.once("error", reject); worker.on("message", (message) => { if (message.type === "ready") resolve(); }); })));
      const results = workers.map((worker) => new Promise<{ type: string; ok: boolean; code?: string }>((resolve, reject) => { worker.once("error", reject); worker.on("message", (message) => { if (message.type === "result") resolve(message); }); }));
      workers.forEach((worker) => worker.postMessage("go"));
      expect(await Promise.all(results)).toEqual(expect.arrayContaining([
        { type: "result", ok: true },
        { type: "result", ok: false, code: "stale_version" },
      ]));
      const verify = new Database(databasePath);
      try {
        const moved = verify.prepare("SELECT location_id, quantity, version FROM stock WHERE id = ?").get(id) as { location_id: string; quantity: number; version: number };
        expect([firstTarget, secondTarget]).toContain(moved.location_id);
        expect(moved).toMatchObject({ quantity: 1, version: 2 });
        expect(verify.prepare("SELECT COUNT(*) AS count FROM activity_log WHERE request_id IN ('request-race-a', 'request-race-b') AND action = 'stock.moved'").get()).toEqual({ count: 1 });
        expect(verify.pragma("foreign_key_check")).toEqual([]);
      } finally { verify.close(); }
    } finally { await Promise.all(workers.map(async (worker) => { if (worker.threadId !== -1) await worker.terminate(); })); }
  });
  it("rollt eine neue Bestandszeile zurück, wenn der Verlaufseintrag scheitert", () => {
    const { databasePath, locationId } = createDb(); const db = new Database(databasePath);
    try { db.exec("CREATE TRIGGER fail_stock_create_audit BEFORE INSERT ON activity_log WHEN NEW.action = 'stock.created' BEGIN SELECT RAISE(ABORT, 'audit failed'); END"); } finally { db.close(); }
    expect(() => recordStock(databasePath, input(locationId), "user-a", "request")).toThrow(/audit failed/);
    const verify = new Database(databasePath);
    try {
      expect(verify.prepare("SELECT COUNT(*) AS count FROM stock").get()).toEqual({ count: 0 });
      expect(verify.prepare("SELECT COUNT(*) AS count FROM activity_log").get()).toEqual({ count: 0 });
    } finally { verify.close(); }
  });
  it("verweigert das Löschen eines Standorts mit Bestand mit einer fachlichen Fehlermeldung", () => {
    const { databasePath, locationId } = createDb();
    const child = createLocation(databasePath, "Bestandsordner", locationId);
    recordStock(databasePath, input(child), "user-a", "request-a");
    expect(() => deleteLocation(databasePath, child)).toThrowError(expect.objectContaining({ code: "not_empty" }));
  });
});
