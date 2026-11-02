ALTER TABLE `cards` ADD COLUMN `source` text;
--> statement-breakpoint
ALTER TABLE `cards` ADD COLUMN `source_id` text CONSTRAINT `cards_source_identity_pair` CHECK ((`source` IS NULL) = (`source_id` IS NULL));
--> statement-breakpoint
CREATE UNIQUE INDEX `cards_source_identity_unique` ON `cards` (`source`,`source_id`);
--> statement-breakpoint
ALTER TABLE `sets` ADD COLUMN `source` text;
--> statement-breakpoint
ALTER TABLE `sets` ADD COLUMN `source_id` text CONSTRAINT `sets_source_identity_pair` CHECK ((`source` IS NULL) = (`source_id` IS NULL));
--> statement-breakpoint
CREATE UNIQUE INDEX `sets_source_identity_unique` ON `sets` (`source`,`source_id`);
--> statement-breakpoint
CREATE TABLE `source_printing_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`source` text NOT NULL,
	`card_source_id` text NOT NULL,
	`set_name` text NOT NULL,
	`printed_code` text NOT NULL,
	`rarity` text NOT NULL,
	`rarity_code` text,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "source_printing_source_nonempty" CHECK(length(trim("source_printing_observations"."source")) > 0),
	CONSTRAINT "source_printing_card_source_id_nonempty" CHECK(length(trim("source_printing_observations"."card_source_id")) > 0),
	CONSTRAINT "source_printing_set_name_nonempty" CHECK(length(trim("source_printing_observations"."set_name")) > 0),
	CONSTRAINT "source_printing_code_nonempty" CHECK(length(trim("source_printing_observations"."printed_code")) > 0),
	CONSTRAINT "source_printing_rarity_nonempty" CHECK(length(trim("source_printing_observations"."rarity")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_printing_identity_unique` ON `source_printing_observations` (`source`,`card_source_id`,`set_name`,`printed_code`,`rarity`);
--> statement-breakpoint
CREATE TABLE `catalog_sync_status` (
	`source` text PRIMARY KEY NOT NULL,
	`last_attempt_at` text NOT NULL,
	`last_success_at` text,
	`database_version` text,
	`database_date` text,
	`status` text NOT NULL,
	`error_code` text,
	`conflict_count` integer DEFAULT 0 NOT NULL,
	`conflict_summary` text DEFAULT '[]' NOT NULL,
	CONSTRAINT "catalog_sync_status_valid" CHECK("catalog_sync_status"."status" IN ('success', 'failed')),
	CONSTRAINT "catalog_sync_conflict_count_nonnegative" CHECK("catalog_sync_status"."conflict_count" >= 0)
);
