import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { syntheticCatalog } from "./db/__tests__/fixtures/catalog";
import { createLocation, deleteLocation, listLocations } from "./locations";
import { correctStock, listStock, recordStock, StockError, type StockInput } from "./stock";

vi.mock("server-only", () => ({}));
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
