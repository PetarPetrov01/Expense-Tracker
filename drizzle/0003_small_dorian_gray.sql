DELETE FROM `expenses`;
ALTER TABLE `expenses` ADD `currency` text NOT NULL DEFAULT 'EUR';
ALTER TABLE `expenses` ADD `rate_to_base_x1e6` integer NOT NULL DEFAULT 1000000;
--> statement-breakpoint
CREATE TABLE `fx_rates` (
  `base` text NOT NULL,
  `quote` text NOT NULL,
  `rate_x1e6` integer NOT NULL,
  `fetched_at` integer NOT NULL,
  PRIMARY KEY(`base`, `quote`)
);
