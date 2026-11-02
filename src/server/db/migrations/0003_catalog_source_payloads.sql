CREATE TABLE `catalog_source_payloads` (
	`source` text NOT NULL,
	`resource` text NOT NULL,
	`payload_json` text NOT NULL,
	`fetched_at` text NOT NULL,
	`database_version` text NOT NULL,
	CONSTRAINT "catalog_payload_source_nonempty" CHECK(length(trim("catalog_source_payloads"."source")) > 0),
	CONSTRAINT "catalog_payload_resource_valid" CHECK("catalog_source_payloads"."resource" IN ('cards_en', 'cards_de', 'sets', 'version')),
	CONSTRAINT "catalog_payload_json_valid" CHECK(json_valid("catalog_source_payloads"."payload_json")),
	CONSTRAINT "catalog_payload_version_nonempty" CHECK(length(trim("catalog_source_payloads"."database_version")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_payload_source_resource_unique` ON `catalog_source_payloads` (`source`,`resource`);