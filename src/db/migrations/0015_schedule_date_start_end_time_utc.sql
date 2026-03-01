-- Migration: schedule_date start and end time in UTC (HH:MM).
-- When created from a recurring event, populated from the event; one-off dates use 00:00–23:59.

ALTER TABLE "schedule_date" ADD COLUMN IF NOT EXISTS "start_time_utc" text NOT NULL DEFAULT '00:00';
ALTER TABLE "schedule_date" ADD COLUMN IF NOT EXISTS "end_time_utc" text NOT NULL DEFAULT '23:59';
