CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`name` text NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`quantity` text DEFAULT '' NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ingredients_list_position` ON `ingredients` (`list_id`,`position`);--> statement-breakpoint
CREATE TABLE `lists` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
