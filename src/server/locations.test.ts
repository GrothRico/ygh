import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocation, deleteLocation, listLocations, moveLocation, renameLocation } from "./locations";

vi.mock("server-only", () => ({}));
const directories: string[] = [];
function databasePath() { const dir = mkdtempSync(join(tmpdir(), "ygh-location-")); directories.push(dir); return join(dir, "test.sqlite"); }
function migrationFolder(maxIndex = 7) {
  const dir = mkdtempSync(join(tmpdir(), "ygh-location-migrations-")); directories.push(dir);
  const folder = join(dir, "migrations"); const meta = join(folder, "meta"); mkdirSync(meta, { recursive: true });
  const source = join(process.cwd(), "src/server/db/migrations");
  const journal = JSON.parse(readFileSync(join(source, "meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  const entries = journal.entries.filter((entry) => entry.idx <= maxIndex);
  writeFileSync(join(meta, "_journal.json"), JSON.stringify({ version: "7", dialect: "sqlite", entries: entries.map((entry, idx) => ({ ...entry, idx })) }, null, 2));
  for (const entry of entries) copyFileSync(join(source, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));
  return folder;
}
function migrate(database: Database.Database, folder = join(process.cwd(), "src/server/db/migrations")) {
  database.pragma("foreign_keys = ON");
  drizzleMigrate(drizzle(database), { migrationsFolder: folder });
}
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("unabhängige Ordner und der Ungeklärt-Eingang", () => {
  it("überführt vorhandene Personenwurzeln zu Root-Ordnern und erhält Bestand und Verlauf mit FK an", () => {
    const db = new Database(databasePath());
    try {
      migrate(db, migrationFolder(6));
      db.prepare("INSERT INTO users (id, identity_subject, display_name, active) VALUES ('u1', 'u1@example.invalid', 'Rico', 1)").run();
      db.prepare("INSERT INTO cards (id, name_en) VALUES ('c1', 'Synthetic card')").run();
      db.prepare("INSERT INTO locations (id, name, kind, parent_id, person_id) VALUES ('person-root', 'Bei Rico', 'person', NULL, 'u1'), ('box', 'Box', 'folder', 'person-root', NULL), ('unknown-old', 'Eingang', 'unknown', NULL, NULL)").run();
      db.prepare("INSERT INTO stock (id, card_id, language, edition, location_id, quantity, version, created_at, updated_at) VALUES ('s1', 'c1', 'de', 'first', 'box', 3, 4, 'created', 'updated')").run();
      db.prepare("INSERT INTO activity_log (id, actor_id, action, entity_type, entity_id, details_json, request_id, created_at) VALUES ('a1', 'u1', 'stock.created', 'stock', 's1', '{\"after\":{\"quantity\":3}}', 'req1', 'created')").run();
      migrate(db);
      migrate(db);
      expect(db.prepare("SELECT id, name, kind, parent_id FROM locations ORDER BY id").all()).toEqual([
        { id: "box", name: "Box", kind: "folder", parent_id: "person-root" },
        { id: "person-root", name: "Bei Rico", kind: "folder", parent_id: null },
        { id: "unknown-old", name: "Eingang", kind: "unknown", parent_id: null },
      ]);
      expect(db.prepare("SELECT id, card_id, language, edition, location_id, quantity, version, created_at, updated_at FROM stock").get()).toEqual({ id: "s1", card_id: "c1", language: "de", edition: "first", location_id: "box", quantity: 3, version: 4, created_at: "created", updated_at: "updated" });
      expect(db.prepare("SELECT id, actor_id, action, entity_id, details_json, request_id, created_at FROM activity_log").get()).toEqual({ id: "a1", actor_id: "u1", action: "stock.created", entity_id: "s1", details_json: '{"after":{"quantity":3}}', request_id: "req1", created_at: "created" });
      expect(db.prepare("PRAGMA table_info(locations)").all()).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: "person_id" })]));
      expect(db.pragma("foreign_keys")).toEqual([{ foreign_keys: 1 }]);
      expect(db.pragma("foreign_key_check")).toEqual([]);
      expect(db.prepare("SELECT COUNT(*) AS count FROM locations WHERE kind = 'unknown'").get()).toEqual({ count: 1 });
    } finally { db.close(); }
  });

  it("führt die unveränderte 0006-Typmigration von Box/Binder/Fach bis zum neuen Ordnerschema aus", () => {
    const db = new Database(databasePath());
    try {
      migrate(db, migrationFolder(5));
      db.prepare("INSERT INTO users (id, identity_subject, display_name, active) VALUES ('u1', 'u1@example.invalid', 'Rico', 1)").run();
      db.prepare("INSERT INTO cards (id, name_en) VALUES ('c1', 'Synthetic card')").run();
      db.prepare("INSERT INTO locations (id, name, kind, parent_id, person_id) VALUES ('root', 'Bei Rico', 'person', NULL, 'u1'), ('box', 'Box', 'box', 'root', NULL), ('binder', 'Binder', 'binder', 'box', NULL), ('slot', 'Fach', 'compartment', 'binder', NULL), ('old-unknown', 'Eingang', 'unknown', NULL, NULL)").run();
      db.prepare("INSERT INTO stock (id, card_id, language, location_id, quantity, version, created_at, updated_at) VALUES ('s1', 'c1', 'en', 'slot', 2, 3, 'created', 'updated')").run();
      db.prepare("INSERT INTO activity_log (id, actor_id, action, entity_type, entity_id, details_json, request_id, created_at) VALUES ('a1', 'u1', 'stock.created', 'stock', 's1', '{\"after\":{\"quantity\":2}}', 'req1', 'created')").run();
      migrate(db);
      expect(db.prepare("SELECT id, name, kind, parent_id FROM locations ORDER BY id").all()).toEqual([
        { id: "binder", name: "Binder", kind: "folder", parent_id: "box" },
        { id: "box", name: "Box", kind: "folder", parent_id: "root" },
        { id: "old-unknown", name: "Eingang", kind: "unknown", parent_id: null },
        { id: "root", name: "Bei Rico", kind: "folder", parent_id: null },
        { id: "slot", name: "Fach", kind: "folder", parent_id: "binder" },
      ]);
      expect(db.prepare("SELECT id, location_id, quantity, version FROM stock").get()).toEqual({ id: "s1", location_id: "slot", quantity: 2, version: 3 });
      expect(db.prepare("SELECT id, entity_id, action FROM activity_log").get()).toEqual({ id: "a1", entity_id: "s1", action: "stock.created" });
      expect(db.pragma("foreign_key_check")).toEqual([]);
      expect(db.pragma("foreign_keys")).toEqual([{ foreign_keys: 1 }]);
    } finally { db.close(); }
  });

  it("neue Datenbank startet nur mit geschütztem Ungeklärt-Eingang und kann Ordner auf Root anlegen", () => {
    const db = new Database(databasePath());
    try {
      migrate(db);
      expect(db.prepare("SELECT id, name, kind, parent_id FROM locations").all()).toEqual([{ id: "location-unknown-default", name: "Ungeklärt", kind: "unknown", parent_id: null }]);
      expect(db.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 0 });
      expect(db.prepare("PRAGMA table_info(locations)").all()).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: "person_id" })]));
    } finally { db.close(); }
    const dbPath = [...directories].map((dir) => join(dir, "test.sqlite")).at(-1)!;
    const root = createLocation(dbPath, "  Schublade  ", null);
    const nested = createLocation(dbPath, "Unterordner", root);
    expect(listLocations(dbPath)).toEqual(expect.arrayContaining([
      { id: root, name: "Schublade", kind: "folder", parentId: null },
      { id: nested, name: "Unterordner", kind: "folder", parentId: root },
    ]));
    expect(() => createLocation(dbPath, "x".repeat(101), root)).toThrowError(expect.objectContaining({ code: "invalid_name" }));
    expect(() => createLocation(dbPath, "Fehlt", "missing-parent")).toThrowError(expect.objectContaining({ code: "parent_missing" }));
  });

  it("verhindert Zyklen und löscht niemals Inhalte oder den Ungeklärt-Eingang", () => {
    const dbPath = databasePath(); const db = new Database(dbPath);
    try {
      migrate(db);
      db.prepare("INSERT INTO cards (id, name_en) VALUES ('c1', 'Synthetic card')").run();
      db.prepare("INSERT INTO stock (id, card_id, location_id, quantity, version, created_at, updated_at) VALUES ('s1', 'c1', 'location-unknown-default', 1, 1, 'created', 'updated')").run();
    } finally { db.close(); }
    const root = createLocation(dbPath, "Root", null);
    const child = createLocation(dbPath, "Child", root);
    const grandchild = createLocation(dbPath, "Grandchild", child);
    expect(() => moveLocation(dbPath, root, grandchild)).toThrowError(expect.objectContaining({ code: "cycle" }));
    expect(() => deleteLocation(dbPath, root)).toThrowError(expect.objectContaining({ code: "not_empty" }));
    expect(() => moveLocation(dbPath, "location-unknown-default", root)).toThrowError(expect.objectContaining({ code: "root_protected" }));
    expect(() => deleteLocation(dbPath, "location-unknown-default")).toThrowError(expect.objectContaining({ code: "root_protected" }));
    const parent = createLocation(dbPath, "Parent", null);
    moveLocation(dbPath, child, null);
    expect(listLocations(dbPath).find((location) => location.id === child)?.parentId).toBeNull();
    moveLocation(dbPath, child, parent);
    renameLocation(dbPath, child, "  Umbenannt  ");
    expect(listLocations(dbPath).find((location) => location.id === child)?.name).toBe("Umbenannt");
    deleteLocation(dbPath, grandchild);
  });

  it("rollt die komplette Migration bei fehlerhafter Bestandswiederherstellung zurück", () => {
    const db = new Database(databasePath());
    try {
      migrate(db, migrationFolder(6));
      db.prepare("INSERT INTO users (id, identity_subject, display_name, active) VALUES ('u1', 'u1@example.invalid', 'Rico', 1)").run();
      db.prepare("INSERT INTO cards (id, name_en) VALUES ('c1', 'Synthetic card')").run();
      db.prepare("INSERT INTO locations (id, name, kind, parent_id, person_id) VALUES ('old-root', 'Bei Rico', 'person', NULL, 'u1')").run();
      const journalBefore = db.prepare("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at").all();
      db.pragma("foreign_keys = OFF");
      db.prepare("INSERT INTO stock (id, card_id, location_id, quantity, version, created_at, updated_at) VALUES ('bad-stock', 'c1', 'missing-location', 1, 1, 'created', 'updated')").run();
      db.pragma("foreign_keys = ON");
      expect(() => migrate(db)).toThrowError(expect.objectContaining({ cause: expect.objectContaining({ code: "SQLITE_CONSTRAINT_FOREIGNKEY" }) }));
      expect(db.prepare("SELECT id, name, kind, parent_id, person_id FROM locations").all()).toEqual([{ id: "old-root", name: "Bei Rico", kind: "person", parent_id: null, person_id: "u1" }]);
      expect(db.prepare("SELECT id, location_id FROM stock").all()).toEqual([{ id: "bad-stock", location_id: "missing-location" }]);
      expect(db.prepare("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at").all()).toEqual(journalBefore);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'locations'").get()).toEqual({ name: "locations" });
      expect(db.pragma("foreign_keys")).toEqual([{ foreign_keys: 1 }]);
    } finally { db.close(); }
  });
});
