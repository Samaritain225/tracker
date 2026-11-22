CREATE TABLE `custom_symptoms` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`created_at` integer
);
