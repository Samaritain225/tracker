ALTER TABLE `settings` ADD `theme` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `app_lock_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `reminders_enabled` integer DEFAULT 0 NOT NULL;