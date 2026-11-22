CREATE TABLE `pregnancies` (
	`id` text PRIMARY KEY NOT NULL,
	`last_period_date` text NOT NULL,
	`scan_due_date` text,
	`started_at` integer,
	`ended_on` text,
	`outcome` text,
	`baby_name` text,
	`breastfeeding` integer,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `pregnancy_moments` (
	`id` text PRIMARY KEY NOT NULL,
	`pregnancy_id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`text` text,
	`photo_file_name` text,
	`created_at` integer,
	FOREIGN KEY (`pregnancy_id`) REFERENCES `pregnancies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pregnancy_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`pregnancy_id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`title` text,
	`weight_kg` real,
	`systolic` integer,
	`diastolic` integer,
	`notes` text,
	`created_at` integer,
	FOREIGN KEY (`pregnancy_id`) REFERENCES `pregnancies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `show_star_sign` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `pregnancy_prompt_dismissed_for` text;