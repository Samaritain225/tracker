CREATE TABLE `fasts_made_up` (
	`id` text PRIMARY KEY NOT NULL,
	`hijri_year` integer NOT NULL,
	`date` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `ramadan_owed` (
	`hijri_year` integer PRIMARY KEY NOT NULL,
	`owed_days` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `school` text;