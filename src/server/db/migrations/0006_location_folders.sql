CREATE TEMP TABLE `__locations_before_folder_migration` AS
SELECT `id`, `name`, `kind`, `parent_id`, `person_id` FROM `locations`;
--> statement-breakpoint
CREATE TEMP TABLE `__stock_before_folder_migration` AS
SELECT `id`, `card_id`, `variant_id`, `printing_id`, `source_observation_id`, `language`, `edition`, `location_id`, `quantity`, `version`, `created_at`, `updated_at` FROM `stock`;
--> statement-breakpoint
DROP TABLE `stock`;
--> statement-breakpoint
DELETE FROM `locations`;
--> statement-breakpoint
DROP TABLE `locations`;
--> statement-breakpoint
CREATE TABLE `locations` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `kind` text NOT NULL,
  `parent_id` text,
  `person_id` text,
  FOREIGN KEY (`parent_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`person_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT "locations_name_length" CHECK(length(trim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "locations_kind_valid" CHECK("kind" IN ('person', 'unknown', 'folder')),
  CONSTRAINT "locations_root_identity_valid" CHECK(("kind" = 'person' AND "parent_id" IS NULL AND "person_id" IS NOT NULL) OR ("kind" = 'unknown' AND "parent_id" IS NULL AND "person_id" IS NULL) OR ("kind" = 'folder' AND "parent_id" IS NOT NULL AND "person_id" IS NULL))
);
--> statement-breakpoint
INSERT INTO `locations` (`id`, `name`, `kind`, `parent_id`, `person_id`)
SELECT `id`, `name`, CASE WHEN `kind` IN ('box', 'binder', 'compartment') THEN 'folder' ELSE `kind` END, `parent_id`, `person_id`
FROM `__locations_before_folder_migration`;
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_person_root_unique` ON `locations` (`person_id`) WHERE `kind` = 'person';
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_unknown_root_unique` ON `locations` (`kind`) WHERE `kind` = 'unknown';
--> statement-breakpoint
CREATE TABLE `stock` (
  `id` text PRIMARY KEY NOT NULL,
  `card_id` text NOT NULL,
  `variant_id` text,
  `printing_id` text,
  `source_observation_id` text,
  `language` text NOT NULL DEFAULT 'unknown',
  `edition` text NOT NULL DEFAULT 'unknown',
  `location_id` text NOT NULL,
  `quantity` integer NOT NULL,
  `version` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`printing_id`) REFERENCES `printings`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`source_observation_id`) REFERENCES `source_printing_observations`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT "stock_language_valid" CHECK (`language` IN ('unknown', 'de', 'en')),
  CONSTRAINT "stock_edition_valid" CHECK (`edition` IN ('unknown', 'first', 'unlimited', 'not_applicable')),
  CONSTRAINT "stock_quantity_positive" CHECK (typeof(`quantity`) = 'integer' AND `quantity` > 0 AND `quantity` <= 9007199254740991),
  CONSTRAINT "stock_version_positive" CHECK (typeof(`version`) = 'integer' AND `version` > 0 AND `version` <= 9007199254740991),
  CONSTRAINT "stock_print_reference_exclusive" CHECK (`source_observation_id` IS NULL OR (`variant_id` IS NULL AND `printing_id` IS NULL))
);
--> statement-breakpoint
INSERT INTO `stock` (`id`, `card_id`, `variant_id`, `printing_id`, `source_observation_id`, `language`, `edition`, `location_id`, `quantity`, `version`, `created_at`, `updated_at`)
SELECT `id`, `card_id`, `variant_id`, `printing_id`, `source_observation_id`, `language`, `edition`, `location_id`, `quantity`, `version`, `created_at`, `updated_at`
FROM `__stock_before_folder_migration`;
--> statement-breakpoint
CREATE INDEX `stock_location_idx` ON `stock` (`location_id`);
--> statement-breakpoint
CREATE INDEX `stock_card_idx` ON `stock` (`card_id`);
--> statement-breakpoint
DROP TABLE `__stock_before_folder_migration`;
--> statement-breakpoint
DROP TABLE `__locations_before_folder_migration`;
