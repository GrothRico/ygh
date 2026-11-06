CREATE TEMP TABLE "_p208_stock_copy" AS SELECT * FROM "stock";
--> statement-breakpoint
CREATE TEMP TABLE "_p208_printings_copy" AS SELECT * FROM "printings";
--> statement-breakpoint
DROP TABLE "stock";
--> statement-breakpoint
DROP TABLE "printings";
--> statement-breakpoint
CREATE TABLE "__new_variants" (
  "id" text PRIMARY KEY NOT NULL,
  "card_id" text NOT NULL,
  "set_id" text NOT NULL,
  "collector_number" text NOT NULL,
  "edition" text NOT NULL,
  "rarity" text NOT NULL,
  "artwork_key" text NOT NULL,
  FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("set_id") REFERENCES "sets"("id") ON UPDATE no action ON DELETE no action,
  CONSTRAINT "variants_collector_number_nonempty" CHECK(length(trim("collector_number")) > 0),
  CONSTRAINT "variants_edition_valid" CHECK("edition" IN ('first', 'unlimited', 'limited', 'not_applicable')),
  CONSTRAINT "variants_rarity_nonempty" CHECK(length(trim("rarity")) > 0),
  CONSTRAINT "variants_artwork_key_nonempty" CHECK(length(trim("artwork_key")) > 0)
);
--> statement-breakpoint
INSERT INTO "__new_variants" ("id", "card_id", "set_id", "collector_number", "edition", "rarity", "artwork_key") SELECT "id", "card_id", "set_id", "collector_number", "edition", "rarity", "artwork_key" FROM "variants";
--> statement-breakpoint
DROP TABLE "variants";
--> statement-breakpoint
ALTER TABLE "__new_variants" RENAME TO "variants";
--> statement-breakpoint
CREATE UNIQUE INDEX "variants_identity_unique" ON "variants" ("card_id", "set_id", "collector_number", "edition", "rarity", "artwork_key");
--> statement-breakpoint
CREATE TABLE "printings" (
  "id" text PRIMARY KEY NOT NULL,
  "variant_id" text NOT NULL,
  "language" text NOT NULL,
  "printed_code" text NOT NULL,
  "source" text NOT NULL,
  "source_id" text NOT NULL,
  FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON UPDATE no action ON DELETE no action,
  CONSTRAINT "printings_language_nonempty" CHECK(length(trim("language")) > 0),
  CONSTRAINT "printings_printed_code_nonempty" CHECK(length(trim("printed_code")) > 0),
  CONSTRAINT "printings_source_nonempty" CHECK(length(trim("source")) > 0),
  CONSTRAINT "printings_source_id_nonempty" CHECK(length(trim("source_id")) > 0)
);
--> statement-breakpoint
INSERT INTO "printings" ("id", "variant_id", "language", "printed_code", "source", "source_id") SELECT "id", "variant_id", "language", "printed_code", "source", "source_id" FROM "_p208_printings_copy";
--> statement-breakpoint
CREATE UNIQUE INDEX "printings_source_identity_unique" ON "printings" ("source", "source_id");
--> statement-breakpoint
CREATE TABLE "stock" (
  "id" text PRIMARY KEY NOT NULL,
  "card_id" text NOT NULL,
  "variant_id" text,
  "printing_id" text,
  "source_observation_id" text,
  "language" text NOT NULL DEFAULT 'unknown',
  "edition" text NOT NULL DEFAULT 'unknown',
  "location_id" text NOT NULL,
  "quantity" integer NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("printing_id") REFERENCES "printings"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("source_observation_id") REFERENCES "source_printing_observations"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON UPDATE no action ON DELETE no action,
  CONSTRAINT "stock_language_valid" CHECK ("language" IN ('unknown', 'de', 'en')),
  CONSTRAINT "stock_edition_valid" CHECK ("edition" IN ('unknown', 'first', 'unlimited', 'limited', 'not_applicable')),
  CONSTRAINT "stock_quantity_positive" CHECK (typeof("quantity") = 'integer' AND "quantity" > 0 AND "quantity" <= 9007199254740991),
  CONSTRAINT "stock_version_positive" CHECK (typeof("version") = 'integer' AND "version" > 0 AND "version" <= 9007199254740991),
  CONSTRAINT "stock_print_reference_exclusive" CHECK ("source_observation_id" IS NULL OR ("variant_id" IS NULL AND "printing_id" IS NULL))
);
--> statement-breakpoint
INSERT INTO "stock" ("id", "card_id", "variant_id", "printing_id", "source_observation_id", "language", "edition", "location_id", "quantity", "version", "created_at", "updated_at") SELECT "id", "card_id", "variant_id", "printing_id", "source_observation_id", "language", "edition", "location_id", "quantity", "version", "created_at", "updated_at" FROM "_p208_stock_copy";
--> statement-breakpoint
CREATE INDEX "stock_location_idx" ON "stock" ("location_id");
--> statement-breakpoint
CREATE INDEX "stock_card_idx" ON "stock" ("card_id");
--> statement-breakpoint
DROP TABLE "_p208_stock_copy";
--> statement-breakpoint
DROP TABLE "_p208_printings_copy";
