CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`name_de` text,
	`name_en` text,
	`effect_de` text,
	`effect_en` text,
	CONSTRAINT "cards_name_present" CHECK(("cards"."name_de" IS NOT NULL AND length(trim("cards"."name_de")) > 0) OR ("cards"."name_en" IS NOT NULL AND length(trim("cards"."name_en")) > 0))
);
--> statement-breakpoint
CREATE TABLE `printings` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`language` text NOT NULL,
	`printed_code` text NOT NULL,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "printings_language_nonempty" CHECK(length(trim("printings"."language")) > 0),
	CONSTRAINT "printings_printed_code_nonempty" CHECK(length(trim("printings"."printed_code")) > 0),
	CONSTRAINT "printings_source_nonempty" CHECK(length(trim("printings"."source")) > 0),
	CONSTRAINT "printings_source_id_nonempty" CHECK(length(trim("printings"."source_id")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `printings_source_identity_unique` ON `printings` (`source`,`source_id`);--> statement-breakpoint
CREATE TABLE `sets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`catalog_status` text DEFAULT 'unreviewed' NOT NULL,
	CONSTRAINT "sets_name_nonempty" CHECK(length(trim("sets"."name")) > 0),
	CONSTRAINT "sets_code_nonempty" CHECK(length(trim("sets"."code")) > 0),
	CONSTRAINT "sets_catalog_status_valid" CHECK("sets"."catalog_status" IN ('unreviewed', 'partial', 'complete'))
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`set_id` text NOT NULL,
	`collector_number` text NOT NULL,
	`edition` text NOT NULL,
	`rarity` text NOT NULL,
	`artwork_key` text NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`set_id`) REFERENCES `sets`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "variants_collector_number_nonempty" CHECK(length(trim("variants"."collector_number")) > 0),
	CONSTRAINT "variants_edition_valid" CHECK("variants"."edition" IN ('first', 'unlimited', 'not_applicable')),
	CONSTRAINT "variants_rarity_nonempty" CHECK(length(trim("variants"."rarity")) > 0),
	CONSTRAINT "variants_artwork_key_nonempty" CHECK(length(trim("variants"."artwork_key")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variants_identity_unique` ON `variants` (`card_id`,`set_id`,`collector_number`,`edition`,`rarity`,`artwork_key`);