import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { searchCards } from "./search";

vi.mock("server-only", () => ({}));

const directories: string[] = [];

function makeCatalog() {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p203-search-"));
  directories.push(directory);
  const databasePath = join(directory, "catalog.sqlite");
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  migrate(drizzle(sqlite), { migrationsFolder: join(process.cwd(), "src/server/db/migrations") });
  sqlite.prepare("INSERT INTO cards (id, source, source_id, name_de, name_en) VALUES (?, ?, ?, ?, ?)")
    .run("card-dragon", "ygoprodeck", "1001", "Beispiel Drache", "Example Dragon");
  sqlite.prepare("INSERT INTO cards (id, source, source_id, name_de, name_en) VALUES (?, ?, ?, ?, ?)")
    .run("card-wizard", "ygoprodeck", "1002", "Kleiner Zauberer", "Small Wizard");
  sqlite.prepare("INSERT INTO cards (id, source, source_id, name_de, name_en) VALUES (?, ?, ?, ?, ?)")
    .run("card-alpha", "ygoprodeck", "1003", "Alpha Drache", "Alpha Dragon");
  sqlite.prepare("INSERT INTO cards (id, source, source_id, name_de, name_en) VALUES (?, ?, ?, ?, ?)")
    .run("card-detail-overflow", "ygoprodeck", "1004", "Zusatzkarte", "Overflow Card");
  sqlite.prepare("INSERT INTO sets (id, name, code, catalog_status) VALUES (?, ?, ?, ?)")
    .run("set-one", "Synthetisches Set", "SYN", "partial");
  sqlite.prepare("INSERT INTO variants (id, card_id, set_id, collector_number, edition, rarity, artwork_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("variant-dragon-a", "card-dragon", "set-one", "001", "first", "synthetic-ultra", "art-a");
  sqlite.prepare("INSERT INTO variants (id, card_id, set_id, collector_number, edition, rarity, artwork_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("variant-dragon-b", "card-dragon", "set-one", "001", "unlimited", "synthetic-ultra", "art-b");
  sqlite.prepare("INSERT INTO printings (id, variant_id, language, printed_code, source, source_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run("printing-dragon-de", "variant-dragon-a", "de", "SYN-DR-001", "synthetic", "print-de");
  sqlite.prepare("INSERT INTO printings (id, variant_id, language, printed_code, source, source_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run("printing-dragon-en", "variant-dragon-b", "en", "SYN-DR-001", "synthetic", "print-en");
  sqlite.prepare("INSERT INTO source_printing_observations (id, card_id, source, card_source_id, set_name, printed_code, rarity) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("observation-dragon", "card-dragon", "ygoprodeck", "1001", "Synthetisches Set", "SYN-DR-001", "Unconfirmed Rare");
  sqlite.prepare("INSERT INTO source_printing_observations (id, card_id, source, card_source_id, set_name, printed_code, rarity) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("observation-wizard", "card-wizard", "ygoprodeck", "1002", "Zweites Synthetisches Set", "SYN-DR-001", "Unconfirmed Super Rare");
  sqlite.prepare("INSERT INTO source_printing_observations (id, card_id, source, card_source_id, set_name, printed_code, rarity) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("observation-alpha", "card-alpha", "ygoprodeck", "1003", "Vorabdruck", "SYN-DR-001A", "Unconfirmed Rare");
  sqlite.close();
  return databasePath;
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("Kartensuche", () => {
  it("findet dieselbe Karte über beide Namen und toleriert kleine Namensfehler", () => {
    const databasePath = makeCatalog();
    for (const query of ["Example Dragon", "Beispiel Drache", "Beispiel Drachx", "Beispielx"]) {
      expect(searchCards(databasePath, query)[0]?.id).toBe("card-dragon");
    }
  });

  it("stellt exakte Codes zuerst und zeigt mehrdeutige bestätigte und unbestätigte Angaben getrennt", () => {
    const databasePath = makeCatalog();
    const sqlite = new Database(databasePath);
    const addPrefixObservation = sqlite.prepare("INSERT INTO source_printing_observations (id, card_id, source, card_source_id, set_name, printed_code, rarity) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (let index = 0; index < 9; index += 1) {
      addPrefixObservation.run(
        `observation-prefix-${index}`,
        "card-detail-overflow",
        "ygoprodeck",
        "1004",
        "Prefix Set",
        `SYN-DR-001X${index}`,
        "Unconfirmed Rare",
      );
    }
    addPrefixObservation.run("observation-overflow-exact", "card-detail-overflow", "ygoprodeck", "1004", "Exact Set", "SYN-DR- 001", "Unconfirmed Secret Rare");
    sqlite.close();
    const results = searchCards(databasePath, "SYN-DR-001");
    expect(results.map((result) => result.id)).toEqual(["card-dragon", "card-wizard", "card-detail-overflow", "card-alpha"]);
    expect(results[0].printings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "confirmed", language: "de", edition: "first", artworkKey: "art-a" }),
      expect.objectContaining({ kind: "confirmed", language: "en", edition: "unlimited", artworkKey: "art-b" }),
      expect.objectContaining({ kind: "unconfirmed", rarity: "Unconfirmed Rare" }),
    ]));
    expect(results[1].printings[0]).toMatchObject({ kind: "unconfirmed", code: "SYN-DR-001" });
    expect(results[0].printings[0].code).toBe("SYN-DR-001");
    expect(results[2].printings[0].code).toBe("SYN-DR- 001");
    expect(results[2].morePrintings).toBeGreaterThan(0);
    expect(results[3].rank).toBeGreaterThan(results[0].rank);
    expect(searchCards(databasePath, "SYN-DR-00X")[0].rank).toBe(3);
    expect(searchCards(databasePath, "", 1)).toEqual([]);
    expect(searchCards(databasePath, "x".repeat(1_000))).toEqual([]);
  });

  it("begrenzt auch stark mehrdeutige Namensabfragen auf 30 Karten", () => {
    const databasePath = makeCatalog();
    const sqlite = new Database(databasePath);
    const insert = sqlite.prepare("INSERT INTO cards (id, name_en) VALUES (?, ?)");
    for (let index = 0; index < 35; index += 1) insert.run(`shared-${index}`, `Shared Name ${index}`);
    sqlite.close();
    expect(searchCards(databasePath, "Shared Name")).toHaveLength(30);
  });
});
