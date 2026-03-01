-- Run this in your SQL editor (Neon, psql, etc.) if migration 0015 did not apply.
-- Idempotent: safe to run multiple times (uses IF NOT EXISTS).

-- 0015: schedule_date start_time_utc and end_time_utc
ALTER TABLE "schedule_date" ADD COLUMN IF NOT EXISTS "start_time_utc" text NOT NULL DEFAULT '00:00';
ALTER TABLE "schedule_date" ADD COLUMN IF NOT EXISTS "end_time_utc" text NOT NULL DEFAULT '23:59';
