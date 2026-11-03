import "server-only";

import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { openDatabase } from "./db";

export type StockLanguage = "unknown" | "de" | "en";
export type StockEdition = "unknown" | "first" | "unlimited" | "not_applicable";
export type StockInput = {
  cardId: string;
  variantId: string | null;
  printingId: string | null;
  sourceObservationId: string | null;
  language: StockLanguage;
  edition: StockEdition;
  locationId: string;
  quantity: number;
};
export type StockRow = StockInput & {
  id: string;
  quantity: number;
  version: number;
  cardName: string;
  cardImageId: string | null;
  locationName: string;
  printingCode: string | null;
  confirmedCode: string | null;
  rarity: string | null;
  artworkKey: string | null;
  observationCode: string | null;
  setName: string | null;
};
export type StockGroup = {
  key: string;
  cardId: string;
  cardName: string;
  cardImageId: string | null;
  edition: StockEdition;
  locationId: string;
  locationName: string;
  total: number;
  languageCounts: Record<StockLanguage, number>;
  rows: StockRow[];
};
export type StockChoice = {
  kind: "variant" | "printing" | "observation";
  id: string;
  variantId: string | null;
  language: string | null;
  edition: string | null;
  code: string | null;
  setName: string | null;
  rarity: string | null;
  artworkKey: string | null;
};

export class StockError extends Error {
  constructor(readonly code: "invalid_input" | "card_missing" | "variant_mismatch" | "printing_mismatch" | "observation_mismatch" | "location_missing" | "stock_missing" | "stale_version") {
    super(code);
    this.name = "StockError";
  }
}

type RawStock = Omit<StockRow, "language" | "edition"> & { language: StockLanguage; edition: StockEdition; cardImageId: string | null };
function withDatabase<T>(databasePath: string, operation: (db: Database.Database) => T): T {
  const connection = openDatabase(databasePath);
  try { return operation(connection.db.$client); } finally { connection.close(); }
}
function transaction<T>(db: Database.Database, operation: () => T): T { return db.transaction(operation).immediate(); }
function asId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.trim() !== value || value.length > 100) throw new StockError("invalid_input");
  return value;
}
function validateInput(input: StockInput): void {
  if (!input || typeof input !== "object" || !asId(input.cardId) || !asId(input.locationId)) throw new StockError("invalid_input");
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) throw new StockError("invalid_input");
  if (!(["unknown", "de", "en"] as unknown[]).includes(input.language)) throw new StockError("invalid_input");
  if (!(["unknown", "first", "unlimited", "not_applicable"] as unknown[]).includes(input.edition)) throw new StockError("invalid_input");
  asId(input.variantId); asId(input.printingId); asId(input.sourceObservationId);
  if (input.sourceObservationId && (input.variantId || input.printingId)) throw new StockError("invalid_input");
  if (input.printingId && !input.variantId) throw new StockError("invalid_input");
}
function validateReferences(db: Database.Database, input: StockInput): void {
  if (!db.prepare("SELECT 1 FROM cards WHERE id = ?").get(input.cardId)) throw new StockError("card_missing");
  if (!db.prepare("SELECT 1 FROM locations WHERE id = ?").get(input.locationId)) throw new StockError("location_missing");
  if (input.variantId) {
    const variant = db.prepare("SELECT card_id AS cardId, edition FROM variants WHERE id = ?").get(input.variantId) as { cardId: string; edition: string } | undefined;
    if (!variant || variant.cardId !== input.cardId || variant.edition !== input.edition) throw new StockError("variant_mismatch");
  }
  if (input.printingId) {
    const printing = db.prepare("SELECT variant_id AS variantId, language FROM printings WHERE id = ?").get(input.printingId) as { variantId: string; language: string } | undefined;
    if (!printing || printing.variantId !== input.variantId || printing.language !== input.language) throw new StockError("printing_mismatch");
  }
  if (input.sourceObservationId) {
    const observation = db.prepare("SELECT card_id AS cardId FROM source_printing_observations WHERE id = ?").get(input.sourceObservationId) as { cardId: string } | undefined;
    if (!observation || observation.cardId !== input.cardId) throw new StockError("observation_mismatch");
  }
}

export function getStockChoices(databasePath: string, cardId: string): StockChoice[] {
  return withDatabase(databasePath, (db) => {
    const variants = db.prepare(`SELECT v.id, v.id AS variantId, NULL AS language, v.edition, v.collector_number AS code, s.name AS setName, v.rarity, v.artwork_key AS artworkKey
      FROM variants v JOIN sets s ON s.id = v.set_id WHERE v.card_id = ? ORDER BY s.name, v.collector_number, v.edition, v.rarity`).all(cardId) as Omit<StockChoice, "kind">[];
    const printings = db.prepare(`SELECT p.id, p.variant_id AS variantId, p.language, v.edition, p.printed_code AS code, s.name AS setName, v.rarity, v.artwork_key AS artworkKey
      FROM printings p JOIN variants v ON v.id = p.variant_id JOIN sets s ON s.id = v.set_id WHERE v.card_id = ? ORDER BY s.name, p.printed_code, p.language`).all(cardId) as Omit<StockChoice, "kind">[];
    const observations = db.prepare(`SELECT o.id, NULL AS variantId, NULL AS language, NULL AS edition, o.printed_code AS code, o.set_name AS setName, o.rarity, NULL AS artworkKey
      FROM source_printing_observations o WHERE o.card_id = ? ORDER BY o.set_name, o.printed_code, o.rarity`).all(cardId) as Omit<StockChoice, "kind">[];
    return [
      ...variants.map((row) => ({ ...row, kind: "variant" as const })),
      ...printings.map((row) => ({ ...row, kind: "printing" as const })),
      ...observations.map((row) => ({ ...row, kind: "observation" as const })),
    ];
  });
}

function referenceLabel(db: Database.Database, input: Pick<StockInput, "variantId" | "printingId" | "sourceObservationId">): string {
  if (input.printingId) {
    const row = db.prepare(`SELECT p.printed_code AS code, s.name AS setName, v.rarity, v.artwork_key AS artworkKey FROM printings p JOIN variants v ON v.id = p.variant_id JOIN sets s ON s.id = v.set_id WHERE p.id = ?`).get(input.printingId) as { code: string; setName: string; rarity: string; artworkKey: string } | undefined;
    return row ? `${row.code} · ${row.setName} · ${row.rarity}${row.artworkKey === "default" ? "" : ` · Artwork ${row.artworkKey}`}` : "Bestätigter Druck";
  }
  if (input.variantId) {
    const row = db.prepare(`SELECT v.collector_number AS code, s.name AS setName, v.rarity, v.artwork_key AS artworkKey FROM variants v JOIN sets s ON s.id = v.set_id WHERE v.id = ?`).get(input.variantId) as { code: string; setName: string; rarity: string; artworkKey: string } | undefined;
    return row ? `${row.code} · ${row.setName} · ${row.rarity}${row.artworkKey === "default" ? "" : ` · Artwork ${row.artworkKey}`}` : "Bestätigte Variante";
  }
  if (input.sourceObservationId) {
    const row = db.prepare(`SELECT printed_code AS code, set_name AS setName, rarity FROM source_printing_observations WHERE id = ?`).get(input.sourceObservationId) as { code: string; setName: string; rarity: string } | undefined;
    return row ? `${row.code} · ${row.setName} · ${row.rarity} · nicht bestätigt` : "Druckangabe nicht bestätigt";
  }
  return "Keine Druckangabe";
}

export function recordStock(databasePath: string, input: StockInput, actorId: string, requestId: string): string {
  validateInput(input);
  if (!asId(actorId) || !asId(requestId)) throw new StockError("invalid_input");
  return withDatabase(databasePath, (db) => transaction(db, () => {
    validateReferences(db, input);
    const now = new Date().toISOString();
    const id = randomUUID();
    db.prepare(`INSERT INTO stock (id, card_id, variant_id, printing_id, source_observation_id, language, edition, location_id, quantity, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(id, input.cardId, input.variantId, input.printingId, input.sourceObservationId, input.language, input.edition, input.locationId, input.quantity, now, now);
    db.prepare(`INSERT INTO activity_log (id, actor_id, action, entity_type, entity_id, details_json, request_id, created_at)
      VALUES (?, ?, 'stock.created', 'stock', ?, ?, ?, ?)`).run(randomUUID(), actorId, id, JSON.stringify({ after: { cardId: input.cardId, variantId: input.variantId, printingId: input.printingId, sourceObservationId: input.sourceObservationId, quantity: input.quantity, language: input.language, edition: input.edition, locationId: input.locationId, reference: referenceLabel(db, input) } }), requestId, now);
    return id;
  }));
}

export function correctStock(databasePath: string, id: string, expectedVersion: number, input: StockInput, actorId: string, requestId: string): void {
  validateInput(input);
  if (!asId(id) || !asId(actorId) || !asId(requestId) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new StockError("invalid_input");
  withDatabase(databasePath, (db) => transaction(db, () => {
    const current = db.prepare(`SELECT id, card_id AS cardId, variant_id AS variantId, printing_id AS printingId, source_observation_id AS sourceObservationId,
      language, edition, location_id AS locationId, quantity, version FROM stock WHERE id = ?`).get(id) as (StockInput & { id: string; version: number }) | undefined;
    if (!current) throw new StockError("stock_missing");
    if (current.version !== expectedVersion) throw new StockError("stale_version");
    if (input.cardId !== current.cardId || input.locationId !== current.locationId) throw new StockError("invalid_input");
    validateReferences(db, input);
    const now = new Date().toISOString();
    const changed = db.prepare(`UPDATE stock SET variant_id = ?, printing_id = ?, source_observation_id = ?, language = ?, edition = ?, quantity = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`)
      .run(input.variantId, input.printingId, input.sourceObservationId, input.language, input.edition, input.quantity, now, id, expectedVersion);
    if (changed.changes !== 1) throw new StockError("stale_version");
    db.prepare(`INSERT INTO activity_log (id, actor_id, action, entity_type, entity_id, details_json, request_id, created_at)
      VALUES (?, ?, 'stock.corrected', 'stock', ?, ?, ?, ?)`).run(randomUUID(), actorId, id, JSON.stringify({ before: { cardId: current.cardId, variantId: current.variantId, printingId: current.printingId, sourceObservationId: current.sourceObservationId, quantity: current.quantity, language: current.language, edition: current.edition, locationId: current.locationId, reference: referenceLabel(db, current) }, after: { cardId: input.cardId, variantId: input.variantId, printingId: input.printingId, sourceObservationId: input.sourceObservationId, quantity: input.quantity, language: input.language, edition: input.edition, locationId: input.locationId, reference: referenceLabel(db, input) }, fromVersion: expectedVersion, toVersion: expectedVersion + 1 }), requestId, now);
  }));
}

export function listStock(databasePath: string, limit = 25, offset = 0, locationId?: string): StockGroup[] {
  return withDatabase(databasePath, (db) => {
    const locationFilter = locationId ? `WHERE st.location_id IN (
      WITH RECURSIVE descendants(id) AS (
        SELECT id FROM locations WHERE id = ?
        UNION ALL SELECT child.id FROM locations child JOIN descendants parent ON child.parent_id = parent.id
      ) SELECT id FROM descendants
    )` : "";
    const query = `SELECT st.id, st.card_id AS cardId, st.variant_id AS variantId, st.printing_id AS printingId, st.source_observation_id AS sourceObservationId,
      st.language, st.edition, st.location_id AS locationId, st.quantity, st.version,
      COALESCE(c.name_de, c.name_en, 'Karte') AS cardName, CASE WHEN c.source = 'ygoprodeck' AND c.source_id GLOB '[0-9]*' AND c.source_id NOT GLOB '*[^0-9]*' THEN c.id ELSE NULL END AS cardImageId, l.name AS locationName,
      p.printed_code AS printingCode, COALESCE(p.printed_code, v.collector_number) AS confirmedCode, COALESCE(v.rarity, o.rarity) AS rarity, v.artwork_key AS artworkKey,
      o.printed_code AS observationCode, COALESCE(s.name, o.set_name) AS setName
      FROM stock st JOIN cards c ON c.id = st.card_id JOIN locations l ON l.id = st.location_id
      LEFT JOIN variants v ON v.id = st.variant_id LEFT JOIN sets s ON s.id = v.set_id
      LEFT JOIN printings p ON p.id = st.printing_id LEFT JOIN source_printing_observations o ON o.id = st.source_observation_id
      ${locationFilter}
      ORDER BY c.name_de COLLATE NOCASE, c.name_en COLLATE NOCASE, st.edition, l.name COLLATE NOCASE, st.id`;
    const rows = (locationId ? db.prepare(query).all(locationId) : db.prepare(query).all()) as RawStock[];
    const groups = new Map<string, StockGroup>();
    for (const row of rows) {
      const identity = row.variantId ? `variant:${row.variantId}` : row.sourceObservationId ? `observation:${row.sourceObservationId}` : `card:${row.cardId}`;
      const key = `${identity}|${row.edition}|${row.locationId}`;
      const existing = groups.get(key);
      const group = existing ?? { key, cardId: row.cardId, cardName: row.cardName, cardImageId: row.cardImageId, edition: row.edition, locationId: row.locationId, locationName: row.locationName, total: 0, languageCounts: { unknown: 0, de: 0, en: 0 }, rows: [] };
      if (!existing) groups.set(key, group);
      group.total += row.quantity;
      group.languageCounts[row.language] += row.quantity;
      group.rows.push(row);
    }
    return [...groups.values()].slice(Math.max(0, offset), Math.max(0, offset) + Math.max(1, Math.min(25, limit)) + 1);
  });
}


export function getStockCard(databasePath: string, cardId: string): { id: string; name: string; nameEn: string | null } | null {
  return withDatabase(databasePath, (db) => db.prepare(`SELECT id, COALESCE(name_de, name_en, 'Karte') AS name, name_en AS nameEn FROM cards WHERE id = ?`).get(cardId) as { id: string; name: string; nameEn: string | null } | undefined ?? null);
}

export type StockActivity = { action: string; actorName: string; createdAt: string; before: Record<string, unknown> | null; after: Record<string, unknown> };
export function listStockActivity(databasePath: string, stockId: string, limit = 5): StockActivity[] {
  return withDatabase(databasePath, (db) => {
    const rows = db.prepare(`SELECT a.action, u.display_name AS actorName, a.created_at AS createdAt, a.details_json AS detailsJson
      FROM activity_log a JOIN users u ON u.id = a.actor_id WHERE a.entity_type = 'stock' AND a.entity_id = ?
      ORDER BY a.created_at DESC, a.id DESC LIMIT ?`).all(stockId, Math.max(1, Math.min(10, limit))) as { action: string; actorName: string; createdAt: string; detailsJson: string }[];
    return rows.map((row) => {
      const details = JSON.parse(row.detailsJson) as { before?: Record<string, unknown>; after: Record<string, unknown> };
      return { action: row.action, actorName: row.actorName, createdAt: row.createdAt, before: details.before ?? null, after: details.after };
    });
  });
}
