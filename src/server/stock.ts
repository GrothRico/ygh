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
  constructor(readonly code: "invalid_input" | "card_missing" | "variant_mismatch" | "printing_mismatch" | "observation_mismatch" | "location_missing" | "stock_missing" | "stale_version" | "invalid_move_quantity" | "move_quantity_exceeds_stock" | "same_location") {
    super(code);
    this.name = "StockError";
  }
}

type StockSnapshot = StockInput & { reference: string };
function stockSnapshot(db: Database.Database, row: StockInput): StockSnapshot {
  return {
    cardId: row.cardId,
    variantId: row.variantId,
    printingId: row.printingId,
    sourceObservationId: row.sourceObservationId,
    language: row.language,
    edition: row.edition,
    locationId: row.locationId,
    quantity: row.quantity,
    reference: referenceLabel(db, row),
  };
}

export type StockMove = { id: string; expectedVersion: number; quantity: number };

export function moveStocks(databasePath: string, moves: StockMove[], destinationId: string, actorId: string, requestId: string): void {
  if (!Array.isArray(moves) || moves.length === 0 || !asId(destinationId) || !asId(actorId) || !asId(requestId)) throw new StockError("invalid_input");
  const ids = new Set<string>();
  for (const move of moves) {
    if (!move || typeof move !== "object" || !asId(move.id) || !Number.isSafeInteger(move.expectedVersion) || move.expectedVersion < 1) throw new StockError("invalid_input");
    if (ids.has(move.id)) throw new StockError("invalid_input");
    ids.add(move.id);
    if (!Number.isSafeInteger(move.quantity) || move.quantity < 1) throw new StockError("invalid_move_quantity");
  }
  withDatabase(databasePath, (db) => transaction(db, () => {
    const now = new Date().toISOString();
    for (const move of moves) moveStockInTransaction(db, move, destinationId, actorId, requestId, now);
  }));
}

export function moveStock(databasePath: string, id: string, expectedVersion: number, destinationId: string, quantity: number, actorId: string, requestId: string): void {
  moveStocks(databasePath, [{ id, expectedVersion, quantity }], destinationId, actorId, requestId);
}

function moveStockInTransaction(db: Database.Database, move: StockMove, destinationId: string, actorId: string, requestId: string, now: string): void {
    const { id, expectedVersion, quantity } = move;
    const current = db.prepare(`SELECT card_id AS cardId, variant_id AS variantId, printing_id AS printingId, source_observation_id AS sourceObservationId,
      language, edition, location_id AS locationId, quantity, version FROM stock WHERE id = ?`).get(id) as (StockInput & { version: number }) | undefined;
    if (!current) throw new StockError("stock_missing");
    if (current.version !== expectedVersion) throw new StockError("stale_version");
    if (current.locationId === destinationId) throw new StockError("same_location");
    if (!db.prepare("SELECT 1 FROM locations WHERE id = ?").get(destinationId)) throw new StockError("location_missing");
    if (quantity > current.quantity) throw new StockError("move_quantity_exceeds_stock");

    const sourceBefore = stockSnapshot(db, current);
    const movement = { sourceStockId: id, targetStockId: quantity === current.quantity ? id : null, sourceLocationId: current.locationId, destinationLocationId: destinationId, quantity };
    if (quantity === current.quantity) {
      const changed = db.prepare("UPDATE stock SET location_id = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?")
        .run(destinationId, now, id, expectedVersion);
      if (changed.changes !== 1) throw new StockError("stale_version");
      const after = stockSnapshot(db, { ...current, locationId: destinationId });
      db.prepare(`INSERT INTO activity_log (id, actor_id, action, entity_type, entity_id, details_json, request_id, created_at)
        VALUES (?, ?, 'stock.moved', 'stock', ?, ?, ?, ?)`).run(randomUUID(), actorId, id, JSON.stringify({ before: sourceBefore, after, movement: { ...movement, targetStockId: id }, fromVersion: expectedVersion, toVersion: expectedVersion + 1 }), requestId, now);
      return;
    }

    const sourceAfter = { ...current, quantity: current.quantity - quantity, version: expectedVersion + 1 };
    const changed = db.prepare("UPDATE stock SET quantity = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?")
      .run(sourceAfter.quantity, now, id, expectedVersion);
    if (changed.changes !== 1) throw new StockError("stale_version");
    const targetId = randomUUID();
    movement.targetStockId = targetId;
    db.prepare(`INSERT INTO stock (id, card_id, variant_id, printing_id, source_observation_id, language, edition, location_id, quantity, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(targetId, current.cardId, current.variantId, current.printingId, current.sourceObservationId, current.language, current.edition, destinationId, quantity, now, now);
    const sourceAfterSnapshot = stockSnapshot(db, sourceAfter);
    const targetAfter = stockSnapshot(db, { ...current, locationId: destinationId, quantity });
    const insertAudit = db.prepare(`INSERT INTO activity_log (id, actor_id, action, entity_type, entity_id, details_json, request_id, created_at)
      VALUES (?, ?, 'stock.moved', 'stock', ?, ?, ?, ?)`);
    insertAudit.run(randomUUID(), actorId, id, JSON.stringify({ before: sourceBefore, after: sourceAfterSnapshot, movement, fromVersion: expectedVersion, toVersion: expectedVersion + 1 }), requestId, now);
    insertAudit.run(randomUUID(), actorId, targetId, JSON.stringify({ before: null, after: targetAfter, movement, fromVersion: null, toVersion: 1 }), requestId, now);
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
  return withDatabase(databasePath, (db) => db.transaction(() => {
    const boundedLimit = Math.max(1, Math.min(25, limit));
    const boundedOffset = Math.max(0, offset);
    const locationFilter = locationId ? `WHERE st.location_id IN (
      WITH RECURSIVE descendants(id) AS (
        SELECT id FROM locations WHERE id = ?
        UNION ALL SELECT child.id FROM locations child JOIN descendants parent ON child.parent_id = parent.id
      ) SELECT id FROM descendants
    )` : "";
    // Filter locations first, then choose page groups in SQLite. This bounds both
    // row details and image-bearing card groups for large collections.
    const grouping = `WITH filtered AS (
      SELECT st.*, c.name_de AS sortNameDe, c.name_en AS sortNameEn,
        COALESCE(c.name_de, c.name_en, 'Karte') AS cardName,
        CASE WHEN c.source = 'ygoprodeck' AND c.source_id GLOB '[0-9]*' AND c.source_id NOT GLOB '*[^0-9]*' THEN c.id ELSE NULL END AS cardImageId,
        l.name AS locationName,
        CASE WHEN st.variant_id IS NOT NULL THEN 'variant:' || st.variant_id
          WHEN st.source_observation_id IS NOT NULL THEN 'observation:' || st.source_observation_id ELSE 'card:' || st.card_id END AS identity,
        CASE WHEN st.variant_id IS NOT NULL THEN st.variant_id WHEN st.source_observation_id IS NOT NULL THEN st.source_observation_id ELSE st.card_id END AS identityId
      FROM stock st JOIN cards c ON c.id = st.card_id JOIN locations l ON l.id = st.location_id
      ${locationFilter}
    ), page_groups AS (
      SELECT identity || '|' || edition || '|' || location_id AS key, card_id AS cardId, cardName, cardImageId,
        edition, location_id AS locationId, locationName, SUM(quantity) AS total,
        SUM(CASE WHEN language = 'de' THEN quantity ELSE 0 END) AS countDe,
        SUM(CASE WHEN language = 'en' THEN quantity ELSE 0 END) AS countEn,
        SUM(CASE WHEN language = 'unknown' THEN quantity ELSE 0 END) AS countUnknown,
        MIN(sortNameDe) AS sortNameDe, MIN(sortNameEn) AS sortNameEn, identity, identityId
      FROM filtered GROUP BY identity, identityId, edition, location_id
      ORDER BY sortNameDe COLLATE NOCASE, sortNameEn COLLATE NOCASE, edition,
        locationName COLLATE NOCASE, identity, identityId, location_id
      LIMIT ? OFFSET ?
    )`;
    const selected = db.prepare(`${grouping} SELECT * FROM page_groups`).all(...(locationId ? [locationId, boundedLimit + 1, boundedOffset] : [boundedLimit + 1, boundedOffset])) as Array<{
      key: string; cardId: string; cardName: string; cardImageId: string | null; edition: StockEdition; locationId: string; locationName: string; total: number;
      countDe: number; countEn: number; countUnknown: number;
    }>;
    const pageGroups = selected.slice(0, boundedLimit);
    if (pageGroups.length === 0) return [];
    const keys = pageGroups.map((group) => group.key);
    const keyPlaceholders = keys.map(() => "?").join(", ");
    const query = `WITH filtered AS (
      SELECT st.*, c.name_de AS sortNameDe, c.name_en AS sortNameEn,
        COALESCE(c.name_de, c.name_en, 'Karte') AS cardName,
        CASE WHEN c.source = 'ygoprodeck' AND c.source_id GLOB '[0-9]*' AND c.source_id NOT GLOB '*[^0-9]*' THEN c.id ELSE NULL END AS cardImageId,
        l.name AS locationName,
        CASE WHEN st.variant_id IS NOT NULL THEN 'variant:' || st.variant_id
          WHEN st.source_observation_id IS NOT NULL THEN 'observation:' || st.source_observation_id ELSE 'card:' || st.card_id END AS identity
      FROM stock st JOIN cards c ON c.id = st.card_id JOIN locations l ON l.id = st.location_id
      ${locationFilter}
    ) SELECT st.id, st.card_id AS cardId, st.variant_id AS variantId, st.printing_id AS printingId, st.source_observation_id AS sourceObservationId,
      st.language, st.edition, st.location_id AS locationId, st.quantity, st.version,
      filtered.cardName, filtered.cardImageId, filtered.locationName,
      p.printed_code AS printingCode, COALESCE(p.printed_code, v.collector_number) AS confirmedCode, COALESCE(v.rarity, o.rarity) AS rarity, v.artwork_key AS artworkKey,
      o.printed_code AS observationCode, COALESCE(s.name, o.set_name) AS setName
      FROM filtered JOIN stock st ON st.id = filtered.id
      LEFT JOIN variants v ON v.id = st.variant_id LEFT JOIN sets s ON s.id = v.set_id
      LEFT JOIN printings p ON p.id = st.printing_id LEFT JOIN source_printing_observations o ON o.id = st.source_observation_id
      WHERE filtered.identity || '|' || st.edition || '|' || st.location_id IN (${keyPlaceholders})
      ORDER BY filtered.sortNameDe COLLATE NOCASE, filtered.sortNameEn COLLATE NOCASE, st.edition, filtered.locationName COLLATE NOCASE, filtered.identity, st.id`;
    const rows = (locationId ? db.prepare(query).all(locationId, ...keys) : db.prepare(query).all(...keys)) as RawStock[];
    const groups = new Map<string, StockGroup>();
    for (const group of pageGroups) groups.set(group.key, { key: group.key, cardId: group.cardId, cardName: group.cardName, cardImageId: group.cardImageId, edition: group.edition, locationId: group.locationId, locationName: group.locationName, total: group.total, languageCounts: { de: group.countDe, en: group.countEn, unknown: group.countUnknown }, rows: [] });
    for (const row of rows) {
      const identity = row.variantId ? `variant:${row.variantId}` : row.sourceObservationId ? `observation:${row.sourceObservationId}` : `card:${row.cardId}`;
      const key = `${identity}|${row.edition}|${row.locationId}`;
      groups.get(key)?.rows.push(row);
    }
    const result = [...groups.values()];
    if (selected.length > boundedLimit) {
      const next = selected[boundedLimit]!;
      result.push({ key: next.key, cardId: next.cardId, cardName: next.cardName, cardImageId: next.cardImageId, edition: next.edition, locationId: next.locationId, locationName: next.locationName, total: next.total, languageCounts: { de: next.countDe, en: next.countEn, unknown: next.countUnknown }, rows: [] });
    }
    return result;
  }).deferred());
}


export function getStockCard(databasePath: string, cardId: string): { id: string; name: string; nameEn: string | null } | null {
  return withDatabase(databasePath, (db) => db.prepare(`SELECT id, COALESCE(name_de, name_en, 'Karte') AS name, name_en AS nameEn FROM cards WHERE id = ?`).get(cardId) as { id: string; name: string; nameEn: string | null } | undefined ?? null);
}

export type StockActivity = { action: string; actorName: string; createdAt: string; before: Record<string, unknown> | null; after: Record<string, unknown>; movement: { quantity: number; sourcePath: string; destinationPath: string } | null };
export function listStockActivity(databasePath: string, stockId: string, limit = 5): StockActivity[] {
  return withDatabase(databasePath, (db) => {
    const locations = db.prepare("SELECT id, name, parent_id AS parentId FROM locations").all() as Array<{ id: string; name: string; parentId: string | null }>;
    const byId = new Map(locations.map((location) => [location.id, location]));
    const pathFor = (id: unknown): string => {
      if (typeof id !== "string") return "Standort unbekannt";
      const names: string[] = [];
      let current = byId.get(id);
      while (current) { names.unshift(current.name); current = current.parentId ? byId.get(current.parentId) : undefined; }
      return names.length ? names.join(" → ") : `Standort-ID ${id}`;
    };
    const rows = db.prepare(`SELECT a.action, u.display_name AS actorName, a.created_at AS createdAt, a.details_json AS detailsJson
      FROM activity_log a JOIN users u ON u.id = a.actor_id WHERE a.entity_type = 'stock' AND a.entity_id = ?
      ORDER BY a.created_at DESC, a.id DESC LIMIT ?`).all(stockId, Math.max(1, Math.min(10, limit))) as { action: string; actorName: string; createdAt: string; detailsJson: string }[];
    return rows.map((row) => {
      const details = JSON.parse(row.detailsJson) as { before?: Record<string, unknown>; after: Record<string, unknown>; movement?: { quantity: number; sourceLocationId: string; destinationLocationId: string } };
      return { action: row.action, actorName: row.actorName, createdAt: row.createdAt, before: details.before ?? null, after: details.after,
        movement: details.movement ? { quantity: details.movement.quantity, sourcePath: pathFor(details.movement.sourceLocationId), destinationPath: pathFor(details.movement.destinationLocationId) } : null };
    });
  });
}
