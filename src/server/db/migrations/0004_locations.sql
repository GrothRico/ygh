CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`parent_id` text,
	`person_id` text,
	FOREIGN KEY (`parent_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "locations_name_length" CHECK(length(trim("locations"."name")) BETWEEN 1 AND 100),
	CONSTRAINT "locations_kind_valid" CHECK("locations"."kind" IN ('person', 'unknown', 'box', 'binder', 'compartment')),
	CONSTRAINT "locations_root_identity_valid" CHECK(("locations"."kind" = 'person' AND "locations"."parent_id" IS NULL AND "locations"."person_id" IS NOT NULL) OR ("locations"."kind" = 'unknown' AND "locations"."parent_id" IS NULL AND "locations"."person_id" IS NULL) OR ("locations"."kind" IN ('box', 'binder', 'compartment') AND "locations"."parent_id" IS NOT NULL AND "locations"."person_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_person_root_unique` ON `locations` (`person_id`) WHERE "locations"."kind" = 'person';--> statement-breakpoint
CREATE UNIQUE INDEX `locations_unknown_root_unique` ON `locations` (`kind`) WHERE "locations"."kind" = 'unknown';
