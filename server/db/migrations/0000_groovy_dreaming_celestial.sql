CREATE TABLE `deck_share_links` (
	`token` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slides` text NOT NULL,
	`aspect_ratio` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deck_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`principal_type` text NOT NULL,
	`principal_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deck_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text DEFAULT 'local@localhost' NOT NULL,
	`deck_id` text NOT NULL,
	`title` text NOT NULL,
	`data` text NOT NULL,
	`change_label` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`data` text NOT NULL,
	`design_system_id` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	`owner_email` text DEFAULT 'local@localhost' NOT NULL,
	`org_id` text,
	`visibility` text DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `design_system_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`principal_type` text NOT NULL,
	`principal_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `design_systems` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`data` text NOT NULL,
	`assets` text,
	`custom_instructions` text DEFAULT '' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	`owner_email` text DEFAULT 'local@localhost' NOT NULL,
	`org_id` text,
	`visibility` text DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enrichment_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`prompt_version` text NOT NULL,
	`markdown` text NOT NULL,
	`model` text NOT NULL,
	`usage_json` text NOT NULL,
	`stop_reason` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fdmd_quota` (
	`user_id` text PRIMARY KEY NOT NULL,
	`enrich_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fdmd_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fdmd_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slide_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_id` text NOT NULL,
	`slide_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`parent_id` text,
	`content` text NOT NULL,
	`quoted_text` text,
	`author_email` text NOT NULL,
	`author_name` text,
	`resolved` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
