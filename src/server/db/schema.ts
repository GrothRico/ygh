import { sql } from "drizzle-orm";
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  identitySubject: text("identity_subject").notNull().unique(),
  displayName: text("display_name").notNull(),
  active: integer("active", { mode: "boolean" })
    .notNull()
    .default(true),
}, (table) => [
  check("users_active_boolean", sql`${table.active} IN (0, 1)`),
]);

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  source: text("source"),
  sourceId: text("source_id"),
  nameDe: text("name_de"),
  nameEn: text("name_en"),
  effectDe: text("effect_de"),
  effectEn: text("effect_en"),
}, (table) => [
  check(
    "cards_name_present",
    sql`(${table.nameDe} IS NOT NULL AND length(trim(${table.nameDe})) > 0) OR (${table.nameEn} IS NOT NULL AND length(trim(${table.nameEn})) > 0)`,
  ),
  check(
    "cards_source_identity_pair",
    sql`(${table.source} IS NULL) = (${table.sourceId} IS NULL)`,
  ),
  uniqueIndex("cards_source_identity_unique").on(table.source, table.sourceId),
]);

export const sets = sqliteTable("sets", {
  id: text("id").primaryKey(),
  source: text("source"),
  sourceId: text("source_id"),
  name: text("name").notNull(),
  code: text("code").notNull(),
  catalogStatus: text("catalog_status").notNull().default("unreviewed"),
}, (table) => [
  check("sets_name_nonempty", sql`length(trim(${table.name})) > 0`),
  check("sets_code_nonempty", sql`length(trim(${table.code})) > 0`),
  check(
    "sets_catalog_status_valid",
    sql`${table.catalogStatus} IN ('unreviewed', 'partial', 'complete')`,
  ),
  check(
    "sets_source_identity_pair",
    sql`(${table.source} IS NULL) = (${table.sourceId} IS NULL)`,
  ),
  uniqueIndex("sets_source_identity_unique").on(table.source, table.sourceId),
]);

export const sourcePrintingObservations = sqliteTable(
  "source_printing_observations",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id),
    source: text("source").notNull(),
    cardSourceId: text("card_source_id").notNull(),
    setName: text("set_name").notNull(),
    printedCode: text("printed_code").notNull(),
    rarity: text("rarity").notNull(),
    rarityCode: text("rarity_code"),
  },
  (table) => [
    check("source_printing_source_nonempty", sql`length(trim(${table.source})) > 0`),
    check("source_printing_card_source_id_nonempty", sql`length(trim(${table.cardSourceId})) > 0`),
    check("source_printing_set_name_nonempty", sql`length(trim(${table.setName})) > 0`),
    check("source_printing_code_nonempty", sql`length(trim(${table.printedCode})) > 0`),
    check("source_printing_rarity_nonempty", sql`length(trim(${table.rarity})) > 0`),
    uniqueIndex("source_printing_identity_unique").on(
      table.source,
      table.cardSourceId,
      table.setName,
      table.printedCode,
      table.rarity,
    ),
  ],
);

export const catalogSyncStatus = sqliteTable("catalog_sync_status", {
  source: text("source").primaryKey(),
  lastAttemptAt: text("last_attempt_at").notNull(),
  lastSuccessAt: text("last_success_at"),
  databaseVersion: text("database_version"),
  databaseDate: text("database_date"),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  conflictCount: integer("conflict_count").notNull().default(0),
  conflictSummary: text("conflict_summary").notNull().default("[]"),
}, (table) => [
  check("catalog_sync_status_valid", sql`${table.status} IN ('success', 'failed')`),
  check("catalog_sync_conflict_count_nonnegative", sql`${table.conflictCount} >= 0`),
]);

export const catalogSourcePayloads = sqliteTable("catalog_source_payloads", {
  source: text("source").notNull(),
  resource: text("resource").notNull(),
  payloadJson: text("payload_json").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  databaseVersion: text("database_version").notNull(),
}, (table) => [
  check("catalog_payload_source_nonempty", sql`length(trim(${table.source})) > 0`),
  check("catalog_payload_resource_valid", sql`${table.resource} IN ('cards_en', 'cards_de', 'sets', 'version')`),
  check("catalog_payload_json_valid", sql`json_valid(${table.payloadJson})`),
  check("catalog_payload_version_nonempty", sql`length(trim(${table.databaseVersion})) > 0`),
  uniqueIndex("catalog_payload_source_resource_unique").on(table.source, table.resource),
]);

export const variants = sqliteTable("variants", {
  id: text("id").primaryKey(),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id),
  setId: text("set_id")
    .notNull()
    .references(() => sets.id),
  collectorNumber: text("collector_number").notNull(),
  edition: text("edition").notNull(),
  rarity: text("rarity").notNull(),
  artworkKey: text("artwork_key").notNull(),
}, (table) => [
  check(
    "variants_collector_number_nonempty",
    sql`length(trim(${table.collectorNumber})) > 0`,
  ),
  check(
    "variants_edition_valid",
    sql`${table.edition} IN ('first', 'unlimited', 'not_applicable')`,
  ),
  check("variants_rarity_nonempty", sql`length(trim(${table.rarity})) > 0`),
  check(
    "variants_artwork_key_nonempty",
    sql`length(trim(${table.artworkKey})) > 0`,
  ),
  uniqueIndex("variants_identity_unique").on(
    table.cardId,
    table.setId,
    table.collectorNumber,
    table.edition,
    table.rarity,
    table.artworkKey,
  ),
]);

export const printings = sqliteTable("printings", {
  id: text("id").primaryKey(),
  variantId: text("variant_id")
    .notNull()
    .references(() => variants.id),
  language: text("language").notNull(),
  printedCode: text("printed_code").notNull(),
  source: text("source").notNull(),
  sourceId: text("source_id").notNull(),
}, (table) => [
  check("printings_language_nonempty", sql`length(trim(${table.language})) > 0`),
  check(
    "printings_printed_code_nonempty",
    sql`length(trim(${table.printedCode})) > 0`,
  ),
  check("printings_source_nonempty", sql`length(trim(${table.source})) > 0`),
  check("printings_source_id_nonempty", sql`length(trim(${table.sourceId})) > 0`),
  uniqueIndex("printings_source_identity_unique").on(
    table.source,
    table.sourceId,
  ),
]);
