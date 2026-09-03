ALTER TABLE `shops` ADD `visit_status` text DEFAULT 'not_visited' NOT NULL;--> statement-breakpoint
ALTER TABLE `shops` ADD `reach_out_sent` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shops` ADD `followup_sent` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shops` ADD `manual_notes` text DEFAULT '' NOT NULL;