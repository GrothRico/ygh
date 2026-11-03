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
CREATE INDEX `stock_location_idx` ON `stock` (`location_id`);
--> statement-breakpoint
CREATE INDEX `stock_card_idx` ON `stock` (`card_id`);
--> statement-breakpoint
CREATE TABLE `activity_log` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_id` text NOT NULL,
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `details_json` text NOT NULL,
  `request_id` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT "activity_log_details_json_valid" CHECK (json_valid(`details_json`)),
  CONSTRAINT "activity_log_action_valid" CHECK (`action` IN ('stock.created', 'stock.corrected')),
  CONSTRAINT "activity_log_entity_type_valid" CHECK (`entity_type` = 'stock')
);
--> statement-breakpoint
CREATE INDEX `activity_log_entity_idx` ON `activity_log` (`entity_type`, `entity_id`, `created_at`);
