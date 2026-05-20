ALTER TABLE `fdmd_quota` ADD `bonus_credits` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `fdmd_builder_keys` (
	`api_key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`verified_at` text DEFAULT (datetime('now')) NOT NULL
);
