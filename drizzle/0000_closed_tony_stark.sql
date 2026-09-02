CREATE TABLE `poems` (
	`id` text PRIMARY KEY NOT NULL,
	`poem_date` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_poems_date` ON `poems` (`poem_date`,`created_at`);