export interface ScheduleEntry {
  id: number;
  scheduleDateId: number;
  date: string;
  roleId: number;
  memberId: number;
  memberName: string;
  roleName: string;
}

export interface ScheduleDateInfo {
  id: number;
  date: string;
  type: "assignable" | "for_everyone";
  label: string | null;
  note: string | null;
  startTimeUtc: string;
  endTimeUtc: string;
  recurringEventId?: number | null;
  recurringEventLabel?: string | null;
  entries: ScheduleEntry[];
}

export interface RoleInfo {
  id: number;
  name: string;
  requiredCount: number;
  displayOrder: number;
  dependsOnRoleId: number | null;
}

export interface HolidayConflict {
  date: string;
  memberId: number;
  memberName: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  detail: string | null;
  userName: string | null;
  createdAt: string;
}

export interface ScheduleDetail {
  id: number;
  month: number;
  year: number;
  status: string;
  entries: ScheduleEntry[];
  scheduleDates: ScheduleDateInfo[];
  roles: RoleInfo[];
  prevScheduleId: number | null;
  nextScheduleId: number | null;
  holidayConflicts?: HolidayConflict[];
  auditLog?: AuditLogEntry[];
}

export interface Member {
  id: number;
  name: string;
  roleIds: number[];
  availableDayIds: number[];
  availability: { weekdayId: number; startTimeUtc: string; endTimeUtc: string }[];
}

export interface ScheduleDay {
  id: number;
  weekdayId: number;
  dayOfWeek: string;
  active: boolean;
  type?: string;
  label?: string | null;
  groupId?: number;
}

export interface ScheduleDetailClientProps {
  slug: string;
  scheduleId: number;
  initialSchedule: ScheduleDetail;
  initialMembers: Member[];
  initialScheduleDays: ScheduleDay[];
}
