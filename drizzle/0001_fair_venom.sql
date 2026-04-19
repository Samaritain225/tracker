CREATE TABLE `daily_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`flow` text,
	`symptoms` text,
	`mood` text,
	`notes` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_logs_date_unique` ON `daily_logs` (`date`);