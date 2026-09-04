DROP INDEX "idx_group_collaborators_group_id";--> statement-breakpoint
DROP INDEX "idx_holidays_member_id";--> statement-breakpoint
DROP INDEX "idx_holidays_user_id";--> statement-breakpoint
CREATE UNIQUE INDEX "group_collaborators_group_user_unique" ON "group_collaborators" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_holidays_member_id_end_date" ON "holidays" USING btree ("member_id","end_date");--> statement-breakpoint
CREATE INDEX "idx_holidays_user_id_end_date" ON "holidays" USING btree ("user_id","end_date");--> statement-breakpoint
CREATE INDEX "idx_schedules_group_status_year_month" ON "schedules" USING btree ("group_id","status","year","month");