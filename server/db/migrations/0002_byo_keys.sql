CREATE TABLE `fdmd_byo_keys` (
  `token` text PRIMARY KEY NOT NULL,
  `api_key` text NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
