CREATE TABLE `club_hash` (
	`key` text NOT NULL,
	`field` text NOT NULL,
	`value` text NOT NULL,
	`expires` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key`, `field`)
);
--> statement-breakpoint
CREATE TABLE `club_kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires` integer DEFAULT 0 NOT NULL
);
