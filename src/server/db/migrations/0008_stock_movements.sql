CREATE TABLE `__new_activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details_json` text NOT NULL,
	`request_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "activity_log_details_json_valid" CHECK(json_valid("__new_activity_log"."details_json")),
	CONSTRAINT "activity_log_action_valid" CHECK("__new_activity_log"."action" IN ('stock.created', 'stock.corrected', 'stock.moved')),
	CONSTRAINT "activity_log_entity_type_valid" CHECK("__new_activity_log"."entity_type" = 'stock')
);
--> statement-breakpoint
INSERT INTO `__new_activity_log`("id", "actor_id", "action", "entity_type", "entity_id", "details_json", "request_id", "created_at") SELECT "id", "actor_id", "action", "entity_type", "entity_id", "details_json", "request_id", "created_at" FROM `activity_log`;--> statement-breakpoint
DROP TABLE `activity_log`;--> statement-breakpoint
ALTER TABLE `__new_activity_log` RENAME TO `activity_log`;--> statement-breakpoint
CREATE INDEX `activity_log_entity_idx` ON `activity_log` (`entity_type`,`entity_id`,`created_at`);