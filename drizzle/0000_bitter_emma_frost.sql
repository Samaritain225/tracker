CREATE TABLE `periods` (
	`id` text PRIMARY KEY NOT NULL,
	`start_date` text NOT NULL,
	`notes` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `periods_start_date_unique` ON `periods` (`start_date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'fr' NOT NULL,
	`calendar_type` text DEFAULT 'gregorian' NOT NULL,
	`fallback_cycle_days` integer DEFAULT 28 NOT NULL,
	`period_duration_days` integer DEFAULT 5 NOT NULL
);
