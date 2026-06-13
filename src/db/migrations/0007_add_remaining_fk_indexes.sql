CREATE INDEX "idx_accounts_user_id" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_exclusive_groups_group_id" ON "exclusive_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_groups_owner_id" ON "groups" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_roles_exclusive_group_id" ON "roles" USING btree ("exclusive_group_id");--> statement-breakpoint
CREATE INDEX "idx_schedule_audit_log_user_id" ON "schedule_audit_log" USING btree ("user_id");