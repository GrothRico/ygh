import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export const CATALOG_SOURCE = "ygoprodeck";
const CARD_ENDPOINT = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
const SET_ENDPOINT = "https://db.ygoprodeck.com/api/v7/cardsets.php";
const VERSION_ENDPOINT = "https://db.ygoprodeck.com/api/v7/checkDBVer.php";
const REQUEST_TIMEOUT_MS = 30_000;

type JsonObject = Record<string, unknown>;

export type CardSetObservation = {
  setName: string;
  printedCode: string;
  rarity: string;
  rarityCode: string | null;
};

export type SourceCard = {
  sourceId: string;
  name: string;
  effect: string | null;
  observations: CardSetObservation[];
};

export type SourceSet = {
  code: string;
  name: string;
  sourceId: string;
};

export type CatalogConflict = {
  kind: "de_card_without_en" | "duplicate_set_code";
  value: string;
};

export type CatalogSnapshot = {
  englishCards: SourceCard[];
  germanCards: SourceCard[];
  sets: SourceSet[];
  databaseVersion: string;
  databaseDate: string | null;
};

export type SyncResult = {
  cardCount: number;
  germanCardCount: number;
  setCount: number;
  observationCount: number;
  conflicts: CatalogConflict[];
};

export class CatalogSyncError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string) {
    super(errorCode);
    this.errorCode = errorCode;
    this.name = "CatalogSyncError";
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CatalogSyncError(`invalid_${field}`);
  }
  return value;
}

function sourceId(value: unknown): string {
  if ((typeof value !== "number" && typeof value !== "string") || !/^\d+$/.test(String(value))) {
    throw new CatalogSyncError("invalid_card_id");
  }
  return String(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getRows(value: unknown, field: string): unknown[] {
  if (Array.isArray(value)) return value;
  if (isObject(value) && Array.isArray(value.data)) return value.data;
  throw new CatalogSyncError(`invalid_${field}_response`);
}

function parseCardList(value: unknown, language: "en" | "de"): SourceCard[] {
  const rows = getRows(value, `${language}_cards`);
  const parsed = new Map<string, SourceCard>();

  for (const row of rows) {
    if (!isObject(row)) throw new CatalogSyncError(`invalid_${language}_card`);
    const id = sourceId(row.id);
    const name = requiredString(row.name, `${language}_name`);
    const effect = optionalString(row.desc);
    const observations = parseObservations(row.card_sets);
    const card: SourceCard = { sourceId: id, name, effect, observations };
    const previous = parsed.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(card)) {
      throw new CatalogSyncError(`conflicting_${language}_card_id`);
    }
    parsed.set(id, card);
  }

  if (language === "en" && parsed.size === 0) {
    throw new CatalogSyncError("empty_en_card_list");
  }
  return [...parsed.values()];
}

function parseObservations(value: unknown): CardSetObservation[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new CatalogSyncError("invalid_card_sets");
  const parsed = new Map<string, CardSetObservation>();

  for (const row of value) {
    if (!isObject(row)) throw new CatalogSyncError("invalid_card_set");
    const observation: CardSetObservation = {
      setName: requiredString(row.set_name, "set_name"),
      printedCode: requiredString(row.set_code, "printed_code"),
      rarity: requiredString(row.set_rarity, "rarity"),
      rarityCode: optionalString(row.set_rarity_code),
    };
    const key = JSON.stringify([
      observation.setName,
      observation.printedCode,
      observation.rarity,
    ]);
    const previous = parsed.get(key);
    if (previous && previous.rarityCode !== observation.rarityCode) {
      throw new CatalogSyncError("conflicting_card_set_observation");
    }
    parsed.set(key, observation);
  }
  return [...parsed.values()];
}

function parseSets(value: unknown): SourceSet[] {
  const rows = getRows(value, "sets");
  const parsed = new Map<string, SourceSet>();
  for (const row of rows) {
    if (!isObject(row)) throw new CatalogSyncError("invalid_set");
    const code = requiredString(row.set_code, "set_code");
    const name = requiredString(row.set_name, "set_name");
    const sourceId = JSON.stringify([code, name]);
    parsed.set(sourceId, { code, name, sourceId });
  }
  if (parsed.size === 0) throw new CatalogSyncError("empty_set_list");
  return [...parsed.values()];
}

function parseVersion(value: unknown): { version: string; date: string | null } {
  if (Array.isArray(value) && value.length !== 1) {
    throw new CatalogSyncError("invalid_version_record_count");
  }
  const root = Array.isArray(value) ? value[0] : value;
  if (!isObject(root)) throw new CatalogSyncError("invalid_version_response");
  const rawVersion = root.database_version;
  if ((typeof rawVersion !== "number" && typeof rawVersion !== "string") || String(rawVersion).trim() === "") {
    throw new CatalogSyncError("invalid_database_version");
  }
  const date = optionalString(root.date);
  const lastUpdate = optionalString(root.last_update);
  if (date && lastUpdate && date !== lastUpdate) {
    throw new CatalogSyncError("conflicting_database_date");
  }
  return { version: String(rawVersion), date: lastUpdate ?? date };
}

export function parseCatalogSnapshot(
  enResponse: unknown,
  deResponse: unknown,
  setsResponse: unknown,
  versionResponse: unknown,
): CatalogSnapshot {
  return {
    englishCards: parseCardList(enResponse, "en"),
    germanCards: parseCardList(deResponse, "de"),
    sets: parseSets(setsResponse),
    ...(() => {
      const version = parseVersion(versionResponse);
      return { databaseVersion: version.version, databaseDate: version.date };
    })(),
  };
}

async function fetchJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "error",
    });
  } catch {
    throw new CatalogSyncError("network_error");
  }
  if (!response.ok) throw new CatalogSyncError("http_error");
  try {
    return await response.json() as unknown;
  } catch {
    throw new CatalogSyncError("invalid_json");
  }
}

type JsonFetcher = (url: string) => Promise<unknown>;

export async function fetchCatalogSnapshot(fetcher: JsonFetcher = fetchJson): Promise<CatalogSnapshot> {
  const [enResponse, deResponse, setsResponse, versionResponse] = await Promise.all([
    fetcher(CARD_ENDPOINT),
    fetcher(`${CARD_ENDPOINT}?language=de`),
    fetcher(SET_ENDPOINT),
    fetcher(VERSION_ENDPOINT),
  ]);
  return parseCatalogSnapshot(enResponse, deResponse, setsResponse, versionResponse);
}

function internalId(kind: "card" | "set" | "observation"): string {
  return `${kind}_${randomUUID()}`;
}

function getConflicts(
  database: Database.Database,
  snapshot: CatalogSnapshot,
): CatalogConflict[] {
  const englishIds = new Set(snapshot.englishCards.map((card) => card.sourceId));
  const conflicts: CatalogConflict[] = snapshot.germanCards
    .filter((card) => !englishIds.has(card.sourceId))
    .map((card) => ({ kind: "de_card_without_en", value: card.sourceId }));

  const namesByCode = new Map<string, Set<string>>();
  const existingSets = database.prepare(
    "SELECT code, name FROM sets WHERE source = ?",
  ).all(CATALOG_SOURCE) as Array<{ code: string; name: string }>;
  for (const set of existingSets) {
    const names = namesByCode.get(set.code) ?? new Set<string>();
    names.add(set.name);
    namesByCode.set(set.code, names);
  }
  for (const set of snapshot.sets) {
    const names = namesByCode.get(set.code) ?? new Set<string>();
    names.add(set.name);
    namesByCode.set(set.code, names);
  }
  for (const [code, names] of namesByCode) {
    if (names.size > 1) conflicts.push({ kind: "duplicate_set_code", value: code });
  }
  return conflicts;
}

export function applyCatalogSnapshot(
  database: Database.Database,
  snapshot: CatalogSnapshot,
  attemptedAt = new Date().toISOString(),
): SyncResult {
  const germanById = new Map(snapshot.germanCards.map((card) => [card.sourceId, card]));
  const cardsBySourceId = new Map<string, string>();
  let observationCount = 0;
  let conflicts: CatalogConflict[] = [];

  const apply = database.transaction(() => {
    conflicts = getConflicts(database, snapshot);
    const findCard = database.prepare(
      "SELECT id FROM cards WHERE source = ? AND source_id = ?",
    );
    const insertCard = database.prepare(
      "INSERT INTO cards (id, source, source_id, name_en, effect_en) VALUES (?, ?, ?, ?, ?)",
    );
    const updateCardEn = database.prepare(
      "UPDATE cards SET name_en = ?, effect_en = COALESCE(?, effect_en) WHERE id = ?",
    );
    const updateCardDe = database.prepare(
      "UPDATE cards SET name_de = ?, effect_de = COALESCE(?, effect_de) WHERE id = ?",
    );

    for (const card of snapshot.englishCards) {
      const existing = findCard.get(CATALOG_SOURCE, card.sourceId) as { id: string } | undefined;
      const id = existing?.id ?? internalId("card");
      if (existing) {
        updateCardEn.run(card.name, card.effect, id);
      } else {
        insertCard.run(id, CATALOG_SOURCE, card.sourceId, card.name, card.effect);
      }
      cardsBySourceId.set(card.sourceId, id);
      const german = germanById.get(card.sourceId);
      if (german) updateCardDe.run(german.name, german.effect, id);
    }

    const insertSet = database.prepare(
      "INSERT INTO sets (id, source, source_id, name, code, catalog_status) VALUES (?, ?, ?, ?, ?, 'partial') ON CONFLICT(source, source_id) DO NOTHING",
    );
    for (const set of snapshot.sets) {
      insertSet.run(internalId("set"), CATALOG_SOURCE, set.sourceId, set.name, set.code);
    }

    const insertObservation = database.prepare(
      "INSERT INTO source_printing_observations (id, card_id, source, card_source_id, set_name, printed_code, rarity, rarity_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source, card_source_id, set_name, printed_code, rarity) DO UPDATE SET rarity_code = COALESCE(excluded.rarity_code, source_printing_observations.rarity_code)",
    );
    for (const card of snapshot.englishCards) {
      const cardId = cardsBySourceId.get(card.sourceId);
      if (!cardId) throw new CatalogSyncError("internal_card_mapping_error");
      for (const observation of card.observations) {
        insertObservation.run(
          internalId("observation"),
          cardId,
          CATALOG_SOURCE,
          card.sourceId,
          observation.setName,
          observation.printedCode,
          observation.rarity,
          observation.rarityCode,
        );
        observationCount += 1;
      }
    }

    database.prepare(
      "INSERT INTO catalog_sync_status (source, last_attempt_at, last_success_at, database_version, database_date, status, error_code, conflict_count, conflict_summary) VALUES (?, ?, ?, ?, ?, 'success', NULL, ?, ?) ON CONFLICT(source) DO UPDATE SET last_attempt_at = excluded.last_attempt_at, last_success_at = excluded.last_success_at, database_version = excluded.database_version, database_date = excluded.database_date, status = 'success', error_code = NULL, conflict_count = excluded.conflict_count, conflict_summary = excluded.conflict_summary",
    ).run(
      CATALOG_SOURCE,
      attemptedAt,
      attemptedAt,
      snapshot.databaseVersion,
      snapshot.databaseDate,
      conflicts.length,
      JSON.stringify(conflicts.slice(0, 25)),
    );
  });

  apply();
  return {
    cardCount: snapshot.englishCards.length,
    germanCardCount: snapshot.germanCards.filter((card) => cardsBySourceId.has(card.sourceId)).length,
    setCount: snapshot.sets.length,
    observationCount,
    conflicts,
  };
}

export async function syncCatalog(
  database: Database.Database,
  fetcher: JsonFetcher = fetchJson,
  attemptedAt = new Date().toISOString(),
): Promise<SyncResult> {
  try {
    const snapshot = await fetchCatalogSnapshot(fetcher);
    return applyCatalogSnapshot(database, snapshot, attemptedAt);
  } catch (error) {
    const errorCode = error instanceof CatalogSyncError ? error.errorCode : "sync_failed";
    try {
      recordCatalogSyncFailure(database, errorCode, attemptedAt);
    } catch {
      // Keep the public error generic if the status row itself cannot be written.
    }
    throw new CatalogSyncError(errorCode);
  }
}

export function recordCatalogSyncFailure(
  database: Database.Database,
  errorCode: string,
  attemptedAt = new Date().toISOString(),
): void {
  const safeErrorCode = /^[a-z0-9_]{1,64}$/.test(errorCode) ? errorCode : "sync_failed";
  database.prepare(
    "INSERT INTO catalog_sync_status (source, last_attempt_at, last_success_at, database_version, database_date, status, error_code, conflict_count, conflict_summary) VALUES (?, ?, NULL, NULL, NULL, 'failed', ?, 0, '[]') ON CONFLICT(source) DO UPDATE SET last_attempt_at = excluded.last_attempt_at, status = 'failed', error_code = excluded.error_code",
  ).run(CATALOG_SOURCE, attemptedAt, safeErrorCode);
}

export function readCatalogSyncStatus(database: Database.Database): JsonObject | null {
  return database.prepare(
    "SELECT source, last_attempt_at AS lastAttemptAt, last_success_at AS lastSuccessAt, database_version AS databaseVersion, database_date AS databaseDate, status, error_code AS errorCode, conflict_count AS conflictCount, conflict_summary AS conflictSummary FROM catalog_sync_status WHERE source = ?",
  ).get(CATALOG_SOURCE) as JsonObject | undefined ?? null;
}
