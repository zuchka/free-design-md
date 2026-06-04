CREATE TABLE `fdmd_credit_promos` (
  `owner_id` text NOT NULL,
  `campaign` text NOT NULL,
  `credits` integer NOT NULL,
  `claimed_at` text DEFAULT (datetime('now')) NOT NULL,
  PRIMARY KEY(`owner_id`, `campaign`)
);
--> statement-breakpoint
CREATE INDEX `fdmd_credit_promos_owner_idx` ON `fdmd_credit_promos` (`owner_id`, `claimed_at`);
