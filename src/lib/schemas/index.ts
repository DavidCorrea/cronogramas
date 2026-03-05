/**
 * Shared Zod schemas for API request validation.
 * Use in route handlers with parseBody() from api-helpers; types from z.infer<typeof schema>.
 */

export { memberCreateSchema, memberUpdateSchema } from "./members";
export { roleCreateSchema, roleUpdateSchema, roleReorderSchema } from "./roles";
export { exclusiveGroupCreateSchema } from "./exclusive-groups";
export { configHolidayCreateSchema } from "./holidays";
export { scheduleNoteSchema } from "./schedule-notes";
export { groupCreateSchema } from "./groups";
export { adminAuthSchema, adminImpersonateSchema } from "./admin";
