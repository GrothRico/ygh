CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_subject` text NOT NULL,
	`display_name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	CONSTRAINT "users_active_boolean" CHECK("users"."active" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_identity_subject_unique` ON `users` (`identity_subject`);