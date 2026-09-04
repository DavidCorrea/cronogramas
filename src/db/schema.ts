import { pgTable, text, integer, serial, boolean, uniqueIndex, index, timestamp, primaryKey } from "drizzle-orm/pg-core";

// ── Auth.js tables ──

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  isAdmin: boolean("is_admin").notNull().default(false),
  canCreateGroups: boolean("can_create_groups").notNull().default(false),
  canExportCalendars: boolean("can_export_calendars").notNull().default(false),
});

export const accounts = pgTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => [
  primaryKey({ columns: [table.provider, table.providerAccountId] }),
  index("idx_accounts_user_id").on(table.userId),
]);

// ── App tables ──

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  calendarExportEnabled: boolean("calendar_export_enabled").notNull().default(false),
}, (table) => [
  index("idx_groups_owner_id").on(table.ownerId),
]);

export const groupCollaborators = pgTable("group_collaborators", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
}, (table) => [
  // A user is a collaborator on a group at most once. Also serves the
  // (group_id, user_id) access check made on every authenticated group view.
  uniqueIndex("group_collaborators_group_user_unique").on(table.groupId, table.userId),
  index("idx_group_collaborators_user_id").on(table.userId),
]);

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "set null" }),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("members_group_email_unique").on(table.groupId, table.email),
  index("idx_members_group_id").on(table.groupId),
  index("idx_members_user_id").on(table.userId),
]);

export const exclusiveGroups = pgTable("exclusive_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
}, (table) => [
  index("idx_exclusive_groups_group_id").on(table.groupId),
]);

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  requiredCount: integer("required_count").notNull().default(1),
  displayOrder: integer("display_order").notNull().default(0),
  dependsOnRoleId: integer("depends_on_role_id"),
  exclusiveGroupId: integer("exclusive_group_id").references(() => exclusiveGroups.id, { onDelete: "set null" }),
  isRelevant: boolean("is_relevant").notNull().default(false),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
}, (table) => [
  index("idx_roles_group_id").on(table.groupId),
  index("idx_roles_exclusive_group_id").on(table.exclusiveGroupId),
]);

export const memberRoles = pgTable("member_roles", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  roleId: integer("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
}, (table) => [
  index("idx_member_roles_member_id").on(table.memberId),
  index("idx_member_roles_role_id").on(table.roleId),
]);

export const weekdays = pgTable("weekdays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
});

export const recurringEvents = pgTable("recurring_events", {
  id: serial("id").primaryKey(),
  weekdayId: integer("weekday_id")
    .notNull()
    .references(() => weekdays.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
  type: text("type").notNull().default("assignable"), // "assignable" | "for_everyone"
  label: text("label").notNull().default("Evento"),
  startTimeUtc: text("start_time_utc").notNull().default("00:00"),
  endTimeUtc: text("end_time_utc").notNull().default("23:59"),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  notes: text("notes"),
}, (table) => [
  index("idx_recurring_events_group_id").on(table.groupId),
  index("idx_recurring_events_weekday_id").on(table.weekdayId),
]);

export const memberAvailability = pgTable("member_availability", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  weekdayId: integer("weekday_id")
    .notNull()
    .references(() => weekdays.id, { onDelete: "cascade" }),
  startTimeUtc: text("start_time_utc").notNull().default("00:00"),
  endTimeUtc: text("end_time_utc").notNull().default("23:59"),
}, (table) => [
  index("idx_member_availability_member_id").on(table.memberId),
  index("idx_member_availability_weekday_id").on(table.weekdayId),
]);

export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" }),
  memberId: integer("member_id")
    .references(() => members.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  description: text("description"),
}, (table) => [
  // Holiday lookups always bound by date range, so carry end_date in the index.
  index("idx_holidays_member_id_end_date").on(table.memberId, table.endDate),
  index("idx_holidays_user_id_end_date").on(table.userId, table.endDate),
]);

export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  status: text("status", { enum: ["draft", "committed"] })
    .notNull()
    .default("draft"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("schedules_group_month_year_unique").on(table.groupId, table.month, table.year),
  index("idx_schedules_group_id").on(table.groupId),
  index("idx_schedules_group_id_status").on(table.groupId, table.status),
  // Prev/next schedule lookups filter on (group_id, status) and take the
  // nearest month by ORDER BY year, month LIMIT 1 — without year/month in the
  // index Postgres sorts the group's whole schedule history to return one row.
  index("idx_schedules_group_status_year_month").on(
    table.groupId,
    table.status,
    table.year,
    table.month,
  ),
]);

export const scheduleDate = pgTable("schedule_date", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id")
    .notNull()
    .references(() => schedules.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  type: text("type").notNull(), // "assignable" | "for_everyone"
  label: text("label"),
  note: text("note"),
  startTimeUtc: text("start_time_utc").notNull().default("00:00"),
  endTimeUtc: text("end_time_utc").notNull().default("23:59"),
  recurringEventId: integer("recurring_event_id").references(() => recurringEvents.id, {
    onDelete: "set null",
  }),
}, (table) => [
  index("idx_schedule_date_schedule_id").on(table.scheduleId),
  index("idx_schedule_date_schedule_id_date").on(table.scheduleId, table.date),
  index("idx_schedule_date_recurring_event_id").on(table.recurringEventId),
]);

export const scheduleDateAssignments = pgTable("schedule_date_assignments", {
  id: serial("id").primaryKey(),
  scheduleDateId: integer("schedule_date_id")
    .notNull()
    .references(() => scheduleDate.id, { onDelete: "cascade" }),
  roleId: integer("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
}, (table) => [
  index("idx_schedule_date_assignments_schedule_date_id").on(table.scheduleDateId),
  index("idx_schedule_date_assignments_role_id").on(table.roleId),
  index("idx_schedule_date_assignments_member_id").on(table.memberId),
]);

export const scheduleAuditLog = pgTable("schedule_audit_log", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id")
    .notNull()
    .references(() => schedules.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_schedule_audit_log_schedule_id").on(table.scheduleId),
  index("idx_schedule_audit_log_user_id").on(table.userId),
]);

export const eventRolePriorities = pgTable("event_role_priorities", {
  id: serial("id").primaryKey(),
  recurringEventId: integer("recurring_event_id")
    .notNull()
    .references(() => recurringEvents.id, { onDelete: "cascade" }),
  roleId: integer("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0),
}, (table) => [
  index("idx_event_role_priorities_recurring_event_id").on(table.recurringEventId),
  index("idx_event_role_priorities_role_id").on(table.roleId),
]);
