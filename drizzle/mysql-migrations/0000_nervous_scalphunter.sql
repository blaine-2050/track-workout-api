CREATE TABLE `tw_log_entries` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`workout_id` varchar(36),
	`move_id` varchar(36) NOT NULL,
	`move_name_snapshot` varchar(64) NOT NULL,
	`measurement_type` enum('strength','aerobic') NOT NULL,
	`weight` decimal(8,2),
	`weight_unit` enum('kg','lbs'),
	`reps` int,
	`duration_seconds` int,
	`started_at` datetime NOT NULL,
	`ended_at` datetime,
	`weight_recorded_at` datetime,
	`reps_recorded_at` datetime,
	`intensity` decimal(4,2),
	`intensity_metric` varchar(32),
	`interval_kind` varchar(16),
	`interval_label` varchar(64),
	`updated_at` datetime NOT NULL,
	CONSTRAINT `tw_log_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tw_moves` (
	`id` varchar(36) NOT NULL,
	`name` varchar(64) NOT NULL,
	`sort_order` int NOT NULL,
	`measurement_type` enum('strength','interval') NOT NULL,
	CONSTRAINT `tw_moves_id` PRIMARY KEY(`id`),
	CONSTRAINT `tw_moves_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `tw_sync_conflicts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entry_id` varchar(36) NOT NULL,
	`client_updated_at` datetime NOT NULL,
	`server_updated_at` datetime NOT NULL,
	`reason` varchar(64) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `tw_sync_conflicts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tw_users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255),
	`created_at` datetime NOT NULL,
	CONSTRAINT `tw_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tw_workouts` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`started_at` datetime NOT NULL,
	`ended_at` datetime,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `tw_workouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `tw_entries_user_idx` ON `tw_log_entries` (`user_id`);--> statement-breakpoint
CREATE INDEX `tw_entries_workout_idx` ON `tw_log_entries` (`workout_id`);--> statement-breakpoint
CREATE INDEX `tw_entries_updated_at_idx` ON `tw_log_entries` (`updated_at`);--> statement-breakpoint
CREATE INDEX `tw_moves_name_idx` ON `tw_moves` (`name`);--> statement-breakpoint
CREATE INDEX `tw_workouts_user_idx` ON `tw_workouts` (`user_id`);