import {
  generateGroupSchedule,
  resolveHolidaysForMember,
  filterRebuildableDates,
  validateDateInScheduleMonth,
  EVENT_DEFAULTS,
  filterSchedulableRoles,
  getDependentRoleIds,
  isDependentRole,
  validateDependentRoleAssignment,
  getEligibleMemberIds,
  computeDatesWithGaps,
  applyPreferredSlots,
} from "@/lib/schedule-model";
import {
  MemberInfo,
  RoleDefinition,
  RecurringEventConfig,
  EventAssignment,
} from "@/lib/scheduler-types";
import { getScheduleDates } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Fixtures for scheduling algorithm scenarios
// ---------------------------------------------------------------------------

const EXCLUSIVE_GROUP_ID = 100;

// Roles — Group 1 (CCMDV)
const CANTANTES: RoleDefinition = { id: 1, name: "Cantantes", requiredCount: 4, exclusiveGroupId: EXCLUSIVE_GROUP_ID };
const MUSICOS: RoleDefinition = { id: 2, name: "Músicos", requiredCount: 2, exclusiveGroupId: EXCLUSIVE_GROUP_ID };
const G1_ROLES = [CANTANTES, MUSICOS];

// Roles without exclusive group (for scenarios 10-15)
const CANTANTES_NO_EX: RoleDefinition = { id: 1, name: "Cantantes", requiredCount: 4 };
const MUSICOS_NO_EX: RoleDefinition = { id: 2, name: "Músicos", requiredCount: 2 };
const G1_ROLES_NO_EX = [CANTANTES_NO_EX, MUSICOS_NO_EX];

// Roles — Group 2 (Iglesia Central)
const ADORACION: RoleDefinition = { id: 3, name: "Adoración", requiredCount: 2 };
const G2_ROLES = [ADORACION];

// Members — Group 1
const CONI_G1: MemberInfo = {
  id: 1, name: "Coni", roleIds: [1],
  availableDays: ["Domingo"],
  availabilityBlocksByDay: { Domingo: [{ startUtc: "09:00", endUtc: "13:00" }] },
  holidays: [{ startDate: "2026-01-15", endDate: "2026-01-31" }],
};
const DANI_G1: MemberInfo = {
  id: 2, name: "Dani", roleIds: [1, 2],
  availableDays: ["Domingo", "Miércoles"],
  availabilityBlocksByDay: {
    Domingo: [{ startUtc: "09:00", endUtc: "21:00" }],
    Miércoles: [{ startUtc: "18:00", endUtc: "21:00" }],
  },
  holidays: [],
};
const G1_MEMBERS = [CONI_G1, DANI_G1];

// Members — Group 2
const CONI_G2: MemberInfo = {
  id: 10, name: "Coni", roleIds: [3],
  availableDays: ["Domingo", "Miércoles"],
  availabilityBlocksByDay: {
    Miércoles: [{ startUtc: "18:00", endUtc: "21:00" }],
    Domingo: [{ startUtc: "08:00", endUtc: "17:00" }],
  },
  holidays: [{ startDate: "2026-01-15", endDate: "2026-01-31" }],
};
const G2_MEMBERS = [CONI_G2];

// Events — Group 1
const G1_WED: RecurringEventConfig = {
  id: 101, weekdayName: "Miércoles", type: "assignable", label: "Evento",
  startTimeUtc: "00:00", endTimeUtc: "23:59",
  rolePriorities: { 1: 0, 2: 1 }, // 1. Cantantes, 2. Músicos
};
const CULTO_DIA: RecurringEventConfig = {
  id: 102, weekdayName: "Domingo", type: "assignable", label: "Culto Dia",
  startTimeUtc: "09:00", endTimeUtc: "13:00",
  rolePriorities: { 2: 0, 1: 1 }, // 1. Músicos, 2. Cantantes
};
const CULTO_NOCHE: RecurringEventConfig = {
  id: 103, weekdayName: "Domingo", type: "assignable", label: "Culto Noche",
  startTimeUtc: "19:00", endTimeUtc: "21:00",
  rolePriorities: { 1: 0, 2: 1 }, // 1. Cantantes, 2. Músicos
};
const G1_EVENTS = [G1_WED, CULTO_DIA, CULTO_NOCHE];

// Events — Group 2
const ENSAYO: RecurringEventConfig = {
  id: 201, weekdayName: "Miércoles", type: "assignable", label: "Ensayo",
  startTimeUtc: "18:00", endTimeUtc: "20:00",
  rolePriorities: { 3: 0 },
};
const REUNION_AM: RecurringEventConfig = {
  id: 202, weekdayName: "Domingo", type: "assignable", label: "Reunión AM",
  startTimeUtc: "10:00", endTimeUtc: "12:00",
  rolePriorities: { 3: 0 },
};
const REUNION_PM: RecurringEventConfig = {
  id: 203, weekdayName: "Domingo", type: "assignable", label: "Reunión PM",
  startTimeUtc: "15:00", endTimeUtc: "17:00",
  rolePriorities: { 3: 0 },
};
const G2_EVENTS = [ENSAYO, REUNION_AM, REUNION_PM];

// Dates
const JAN_SUNDAYS = ["2026-01-04", "2026-01-11", "2026-01-18", "2026-01-25"];
const JAN_WEDNESDAYS = ["2026-01-07", "2026-01-14", "2026-01-21", "2026-01-28"];
const JAN_DATES = [...JAN_SUNDAYS, ...JAN_WEDNESDAYS].sort();

// Helpers
function assignmentsForEvent(assignments: EventAssignment[], eventId: number) {
  return assignments.filter((a) => a.recurringEventId === eventId);
}
function assignmentsForDateEvent(assignments: EventAssignment[], date: string, eventId: number) {
  return assignments.filter((a) => a.date === date && a.recurringEventId === eventId);
}
function memberRolesOnDateEvent(assignments: EventAssignment[], date: string, eventId: number, memberId: number) {
  return assignments
    .filter((a) => a.date === date && a.recurringEventId === eventId && a.memberId === memberId)
    .map((a) => a.roleId);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateGroupSchedule — scheduling algorithm scenarios", () => {
  // Generate January for Group 1 with exclusive groups (standard scenario)
  function runG1January() {
    return generateGroupSchedule({
      dates: JAN_DATES,
      events: G1_EVENTS,
      roles: G1_ROLES,
      members: G1_MEMBERS,
    });
  }

  // Generate January for Group 1 without exclusive groups
  function runG1JanuaryNoExclusive() {
    return generateGroupSchedule({
      dates: JAN_DATES,
      events: G1_EVENTS,
      roles: G1_ROLES_NO_EX,
      members: G1_MEMBERS,
    });
  }

  // Generate January for Group 2
  function runG2January() {
    return generateGroupSchedule({
      dates: JAN_DATES,
      events: G2_EVENTS,
      roles: G2_ROLES,
      members: G2_MEMBERS,
    });
  }

  // -----------------------------------------------------------------------
  // 2a. Eligibility — Group 1 (scenarios 1-9)
  // -----------------------------------------------------------------------
  describe("Eligibility — Group 1 (scenarios 1–9)", () => {
    it("#1: eligible — has role, not on holidays, time matches (Coni → Culto Dia on 01-04)", () => {
      const result = runG1January();
      const roles = memberRolesOnDateEvent(result.assignments, "2026-01-04", CULTO_DIA.id, CONI_G1.id);
      expect(roles).toContain(CANTANTES.id);
    });

    it("#2: eligible — wider availability covers event span (Dani → Culto Dia on 01-04)", () => {
      const result = runG1January();
      const roles = memberRolesOnDateEvent(result.assignments, "2026-01-04", CULTO_DIA.id, DANI_G1.id);
      expect(roles.length).toBeGreaterThan(0);
    });

    it("#3: eligible — member holds multiple roles for the event (Dani has Cantantes + Músicos)", () => {
      const result = runG1JanuaryNoExclusive();
      const roles = memberRolesOnDateEvent(result.assignments, "2026-01-04", CULTO_DIA.id, DANI_G1.id);
      expect(roles).toContain(CANTANTES.id);
      expect(roles).toContain(MUSICOS.id);
    });

    it("#4: eligible — no holidays, always available (Dani assigned on every G1 event all month)", () => {
      const result = runG1January();
      for (const date of JAN_DATES) {
        const daniAssignments = result.assignments.filter((a) => a.date === date && a.memberId === DANI_G1.id);
        expect(daniAssignments.length).toBeGreaterThan(0);
      }
    });

    it("#5: not eligible — no availability on that day (Coni → Wed unnamed on 01-07)", () => {
      const result = runG1January();
      const coniWed = assignmentsForDateEvent(result.assignments, "2026-01-07", G1_WED.id)
        .filter((a) => a.memberId === CONI_G1.id);
      expect(coniWed).toHaveLength(0);
    });

    it("#6: not eligible — available but wrong time (Coni → Culto Noche on 01-04)", () => {
      const result = runG1January();
      const coniNoche = memberRolesOnDateEvent(result.assignments, "2026-01-04", CULTO_NOCHE.id, CONI_G1.id);
      expect(coniNoche).toHaveLength(0);
    });

    it("#7: not eligible — on holidays, time would match (Coni → Culto Dia on 01-18)", () => {
      const result = runG1January();
      const coniDia = memberRolesOnDateEvent(result.assignments, "2026-01-18", CULTO_DIA.id, CONI_G1.id);
      expect(coniDia).toHaveLength(0);
    });

    it("#8: not eligible — on holidays, no availability on that day (Coni → Wed on 01-21)", () => {
      const result = runG1January();
      const coniWed = assignmentsForDateEvent(result.assignments, "2026-01-21", G1_WED.id)
        .filter((a) => a.memberId === CONI_G1.id);
      expect(coniWed).toHaveLength(0);
    });

    it("#9: not eligible — on holidays, available but wrong time (Coni → Culto Noche on 01-18)", () => {
      const result = runG1January();
      const coniNoche = memberRolesOnDateEvent(result.assignments, "2026-01-18", CULTO_NOCHE.id, CONI_G1.id);
      expect(coniNoche).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 2b. Eligibility — Group 2 (scenarios covered by 1-9 pattern)
  // -----------------------------------------------------------------------
  describe("Eligibility — Group 2", () => {
    it("Coni eligible for all G2 events pre-holiday", () => {
      const result = runG2January();
      for (const date of ["2026-01-04", "2026-01-11"]) {
        expect(assignmentsForDateEvent(result.assignments, date, REUNION_AM.id)).toHaveLength(1);
        expect(assignmentsForDateEvent(result.assignments, date, REUNION_PM.id)).toHaveLength(1);
      }
      for (const date of ["2026-01-07", "2026-01-14"]) {
        expect(assignmentsForDateEvent(result.assignments, date, ENSAYO.id)).toHaveLength(1);
      }
    });

    it("Coni not eligible for G2 events during holidays", () => {
      const result = runG2January();
      for (const date of ["2026-01-18", "2026-01-25"]) {
        expect(assignmentsForDateEvent(result.assignments, date, REUNION_AM.id)).toHaveLength(0);
        expect(assignmentsForDateEvent(result.assignments, date, REUNION_PM.id)).toHaveLength(0);
      }
      for (const date of ["2026-01-21", "2026-01-28"]) {
        expect(assignmentsForDateEvent(result.assignments, date, ENSAYO.id)).toHaveLength(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // 2c. Role-priority assignment (scenarios 10-17)
  // -----------------------------------------------------------------------
  describe("Role-priority assignment (scenarios 10–17)", () => {
    it("#10: sole member with a role fills it when eligible (Dani → Músicos on Culto Dia)", () => {
      const result = runG1January();
      const daniMusicos = memberRolesOnDateEvent(result.assignments, "2026-01-04", CULTO_DIA.id, DANI_G1.id);
      expect(daniMusicos).toContain(MUSICOS.id);
    });

    it("#11: member with multiple roles, no exclusive group → assigned to all (Dani → Músicos + Cantantes)", () => {
      const result = runG1JanuaryNoExclusive();
      const roles = memberRolesOnDateEvent(result.assignments, "2026-01-04", CULTO_DIA.id, DANI_G1.id);
      expect(roles).toContain(CANTANTES.id);
      expect(roles).toContain(MUSICOS.id);
    });

    it("#12: two eligible for same role, max not reached → both assigned (Coni + Dani → Cantantes)", () => {
      const result = runG1JanuaryNoExclusive();
      const cantantesAssignments = assignmentsForDateEvent(result.assignments, "2026-01-04", CULTO_DIA.id)
        .filter((a) => a.roleId === CANTANTES.id);
      const memberIds = cantantesAssignments.map((a) => a.memberId);
      expect(memberIds).toContain(CONI_G1.id);
      expect(memberIds).toContain(DANI_G1.id);
    });

    it("#13: only one member eligible for event → gets all applicable roles (Dani → Noche)", () => {
      const result = runG1JanuaryNoExclusive();
      const roles = memberRolesOnDateEvent(result.assignments, "2026-01-04", CULTO_NOCHE.id, DANI_G1.id);
      expect(roles).toContain(CANTANTES.id);
      expect(roles).toContain(MUSICOS.id);
    });

    it("#14: one member on holidays → available member covers all (Dani covers 01-18)", () => {
      const result = runG1JanuaryNoExclusive();
      const daniRoles = memberRolesOnDateEvent(result.assignments, "2026-01-18", CULTO_DIA.id, DANI_G1.id);
      expect(daniRoles).toContain(CANTANTES.id);
      expect(daniRoles).toContain(MUSICOS.id);
      const coniRoles = memberRolesOnDateEvent(result.assignments, "2026-01-18", CULTO_DIA.id, CONI_G1.id);
      expect(coniRoles).toHaveLength(0);
    });

    it("#15: priority determines fill sequence, same result when unconstrained", () => {
      // Músicos > Cantantes (original)
      const r1 = runG1JanuaryNoExclusive();
      // Cantantes > Músicos
      const altEvents = G1_EVENTS.map((e) =>
        e.id === CULTO_DIA.id ? { ...e, rolePriorities: { 1: 0, 2: 1 } } : e
      );
      const r2 = generateGroupSchedule({
        dates: JAN_DATES, events: altEvents, roles: G1_ROLES_NO_EX, members: G1_MEMBERS,
      });
      const rolesR1 = assignmentsForDateEvent(r1.assignments, "2026-01-04", CULTO_DIA.id)
        .sort((a, b) => a.roleId - b.roleId || a.memberId - b.memberId);
      const rolesR2 = assignmentsForDateEvent(r2.assignments, "2026-01-04", CULTO_DIA.id)
        .sort((a, b) => a.roleId - b.roleId || a.memberId - b.memberId);
      expect(rolesR1.map((a) => ({ r: a.roleId, m: a.memberId }))).toEqual(
        rolesR2.map((a) => ({ r: a.roleId, m: a.memberId }))
      );
    });

    it("#16: priority would differ with exclusive groups — higher-priority wins", () => {
      // Músicos > Cantantes → Dani gets Músicos (blocked from Cantantes)
      const r1 = runG1January();
      const daniR1 = memberRolesOnDateEvent(r1.assignments, "2026-01-04", CULTO_DIA.id, DANI_G1.id);
      expect(daniR1).toContain(MUSICOS.id);
      expect(daniR1).not.toContain(CANTANTES.id);

      // Cantantes > Músicos → Dani gets Cantantes (blocked from Músicos)
      const altEvents = G1_EVENTS.map((e) =>
        e.id === CULTO_DIA.id ? { ...e, rolePriorities: { 1: 0, 2: 1 } } : e
      );
      const r2 = generateGroupSchedule({
        dates: JAN_DATES, events: altEvents, roles: G1_ROLES, members: G1_MEMBERS,
      });
      const daniR2 = memberRolesOnDateEvent(r2.assignments, "2026-01-04", CULTO_DIA.id, DANI_G1.id);
      expect(daniR2).toContain(CANTANTES.id);
      expect(daniR2).not.toContain(MUSICOS.id);
    });

    it("#17: priority would differ with tight max — round-robin decides", () => {
      const cantantesMax1: RoleDefinition = { id: 1, name: "Cantantes", requiredCount: 1 };
      const result = generateGroupSchedule({
        dates: JAN_SUNDAYS,
        events: [CULTO_DIA],
        roles: [cantantesMax1],
        members: G1_MEMBERS,
      });
      // Pre-holiday: Coni gets 01-04 (alphabetical first), Dani gets 01-11
      const firstDate = result.assignments.find((a) => a.date === "2026-01-04");
      const secondDate = result.assignments.find((a) => a.date === "2026-01-11");
      expect(firstDate?.memberId).toBe(CONI_G1.id);
      expect(secondDate?.memberId).toBe(DANI_G1.id);
    });
  });

  // -----------------------------------------------------------------------
  // 2c. Exclusive-group assignment (scenarios 18-26)
  // -----------------------------------------------------------------------
  describe("Exclusive-group assignment (scenarios 18–26)", () => {
    it("#18: exclusive group blocks second role on same date (Dani gets Músicos → blocked from Cantantes)", () => {
      const result = runG1January();
      const daniRoles = memberRolesOnDateEvent(result.assignments, "2026-01-04", CULTO_DIA.id, DANI_G1.id);
      expect(daniRoles).toContain(MUSICOS.id);
      expect(daniRoles).not.toContain(CANTANTES.id);
    });

    it("#19: exclusive group → lower-priority role unfilled on Culto Noche", () => {
      const result = runG1January();
      // Culto Noche priority: 1. Cantantes, 2. Músicos
      // Dani has Músicos from Culto Dia → blocked from Cantantes → Cantantes unfilled
      const nocheAssignments = assignmentsForDateEvent(result.assignments, "2026-01-04", CULTO_NOCHE.id);
      const cantantesNoche = nocheAssignments.filter((a) => a.roleId === CANTANTES.id);
      expect(cantantesNoche).toHaveLength(0);
      // Músicos is same role Dani already has → allowed
      const musicosNoche = nocheAssignments.filter((a) => a.roleId === MUSICOS.id);
      expect(musicosNoche).toHaveLength(1);
      expect(musicosNoche[0].memberId).toBe(DANI_G1.id);
    });

    it("#20: same role on two events same date → not blocked by exclusive group", () => {
      const result = runG1January();
      const daniDia = memberRolesOnDateEvent(result.assignments, "2026-01-04", CULTO_DIA.id, DANI_G1.id);
      const daniNoche = memberRolesOnDateEvent(result.assignments, "2026-01-04", CULTO_NOCHE.id, DANI_G1.id);
      expect(daniDia).toContain(MUSICOS.id);
      expect(daniNoche).toContain(MUSICOS.id);
    });

    it("#21: single-role member unaffected by exclusive group (Coni only has Cantantes)", () => {
      const result = runG1January();
      const coniDia = memberRolesOnDateEvent(result.assignments, "2026-01-04", CULTO_DIA.id, CONI_G1.id);
      expect(coniDia).toContain(CANTANTES.id);
    });

    it("#22: event processing order changes exclusive-group outcome", () => {
      // Default: Dia first (09:00) → Dani gets Músicos
      const r1 = runG1January();
      const daniDiaR1 = memberRolesOnDateEvent(r1.assignments, "2026-01-04", CULTO_DIA.id, DANI_G1.id);
      expect(daniDiaR1).toContain(MUSICOS.id);

      // Alternative: Noche first (swap start times so Noche processes first)
      const nocheFirst: RecurringEventConfig = { ...CULTO_NOCHE, startTimeUtc: "05:00", endTimeUtc: "07:00" };
      const diaSecond: RecurringEventConfig = { ...CULTO_DIA, startTimeUtc: "19:00", endTimeUtc: "21:00" };
      // Adjust member availability so both events are reachable by Dani
      const daniAlt: MemberInfo = {
        ...DANI_G1,
        availabilityBlocksByDay: {
          ...DANI_G1.availabilityBlocksByDay,
          Domingo: [{ startUtc: "05:00", endUtc: "21:00" }],
        },
      };
      const r2 = generateGroupSchedule({
        dates: ["2026-01-04"],
        events: [G1_WED, nocheFirst, diaSecond],
        roles: G1_ROLES,
        members: [CONI_G1, daniAlt],
      });
      // Noche (processed first) priority: 1. Cantantes — Dani gets Cantantes
      const daniNocheR2 = memberRolesOnDateEvent(r2.assignments, "2026-01-04", CULTO_NOCHE.id, daniAlt.id);
      expect(daniNocheR2).toContain(CANTANTES.id);
    });

    it("#23: priority order + exclusive group → different assignments", () => {
      // Músicos > Cantantes: Dani = Músicos
      const r1 = runG1January();
      const daniR1 = memberRolesOnDateEvent(r1.assignments, "2026-01-04", CULTO_DIA.id, DANI_G1.id);
      expect(daniR1).toContain(MUSICOS.id);

      // Cantantes > Músicos: Dani = Cantantes
      const altDia = { ...CULTO_DIA, rolePriorities: { 1: 0, 2: 1 } };
      const r2 = generateGroupSchedule({
        dates: JAN_DATES,
        events: [G1_WED, altDia, CULTO_NOCHE],
        roles: G1_ROLES,
        members: G1_MEMBERS,
      });
      const daniR2 = memberRolesOnDateEvent(r2.assignments, "2026-01-04", CULTO_DIA.id, DANI_G1.id);
      expect(daniR2).toContain(CANTANTES.id);
    });

    it("#24: both members blocked/unavailable → role unfilled", () => {
      const result = runG1January();
      // Holiday Sunday Culto Dia: Dani gets Músicos (exclusive-blocked from Cantantes), Coni on holidays
      const cantantes = assignmentsForDateEvent(result.assignments, "2026-01-18", CULTO_DIA.id)
        .filter((a) => a.roleId === CANTANTES.id);
      expect(cantantes).toHaveLength(0);
      const unfilled = result.unfilledSlots.filter(
        (u) => u.date === "2026-01-18" && u.roleId === CANTANTES.id && u.recurringEventId === CULTO_DIA.id
      );
      expect(unfilled.length).toBeGreaterThan(0);
    });

    it("#25: role not in exclusive group → assigned independently (G2 Adoración)", () => {
      const result = runG2January();
      const adoracion = assignmentsForDateEvent(result.assignments, "2026-01-04", REUNION_AM.id);
      expect(adoracion).toHaveLength(1);
      expect(adoracion[0].memberId).toBe(CONI_G2.id);
    });

    it("#26: exclusive group only applies within a group, not across groups", () => {
      // Run G1 and G2 independently — Dani's Músicos in G1 doesn't affect G2
      const g1 = runG1January();
      const g2 = runG2January();
      const daniG1 = g1.assignments.filter((a) => a.date === "2026-01-04" && a.memberId === DANI_G1.id);
      expect(daniG1.length).toBeGreaterThan(0);
      // G2 is independent — Coni assigned without reference to G1
      const coniG2 = g2.assignments.filter((a) => a.date === "2026-01-04" && a.memberId === CONI_G2.id);
      expect(coniG2.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // 2d. Cross-group conflicts (scenarios 27-31) — tested in dashboard-conflicts.spec.ts
  // -----------------------------------------------------------------------
  describe("Cross-group conflicts note (scenarios 27–31)", () => {
    it("cross-group conflicts are tested in dashboard-conflicts.spec.ts (not part of scheduler model)", () => {
      expect(true).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 2e. Month continuity (scenarios 32-40)
  // -----------------------------------------------------------------------
  describe("Month continuity (scenarios 32–40)", () => {
    const FEB_SUNDAYS = ["2026-02-01", "2026-02-08", "2026-02-15", "2026-02-22"];
    const FEB_WEDNESDAYS = ["2026-02-04", "2026-02-11", "2026-02-18", "2026-02-25"];
    const FEB_DATES = [...FEB_SUNDAYS, ...FEB_WEDNESDAYS].sort();

    function runJanThenFeb() {
      const jan = runG1January();
      const feb = generateGroupSchedule({
        dates: FEB_DATES,
        events: G1_EVENTS,
        roles: G1_ROLES,
        members: G1_MEMBERS,
        previousAssignments: jan.assignments,
      });
      return { jan, feb };
    }

    it("#32: pattern repeats when constraints fully determine assignments", () => {
      const { jan, feb } = runJanThenFeb();
      // Pre-holiday Jan Sunday pattern = Feb Sunday pattern
      for (const janDate of ["2026-01-04"]) {
        const janDia = assignmentsForDateEvent(jan.assignments, janDate, CULTO_DIA.id)
          .map((a) => ({ r: a.roleId, m: a.memberId }))
          .sort((a, b) => a.r - b.r);
        const febDia = assignmentsForDateEvent(feb.assignments, "2026-02-01", CULTO_DIA.id)
          .map((a) => ({ r: a.roleId, m: a.memberId }))
          .sort((a, b) => a.r - b.r);
        expect(febDia).toEqual(janDia);
      }
    });

    it("#33: round-robin pointer carries over from previous month", () => {
      const { feb } = runJanThenFeb();
      // Cantantes-Sunday: Coni was last assigned in Jan → pointer carried to Feb
      const firstFebCantantes = feb.assignments.find(
        (a) => a.date === "2026-02-01" && a.roleId === CANTANTES.id && a.recurringEventId === CULTO_DIA.id
      );
      expect(firstFebCantantes).toBeDefined();
    });

    it("#34: returning member re-enters rotation at pointer position (Coni back Feb 01)", () => {
      const { feb } = runJanThenFeb();
      const coniRoles = memberRolesOnDateEvent(feb.assignments, "2026-02-01", CULTO_DIA.id, CONI_G1.id);
      expect(coniRoles).toContain(CANTANTES.id);
    });

    it("#35: pointer doesn't skip past holiday member → fairness on return", () => {
      // Coni missed 01-18 and 01-25 but pointer stayed → she goes first in Feb
      const { feb } = runJanThenFeb();
      const coniFirst = feb.assignments.find(
        (a) => a.date === "2026-02-01" && a.roleId === CANTANTES.id && a.recurringEventId === CULTO_DIA.id
      );
      expect(coniFirst?.memberId).toBe(CONI_G1.id);
    });

    it("#36: round-robin irrelevant when exclusive group leaves one eligible", () => {
      const { feb } = runJanThenFeb();
      // Cantantes on Culto Dia: always Coni (Dani blocked after getting Músicos)
      for (const date of FEB_SUNDAYS) {
        const cantantes = assignmentsForDateEvent(feb.assignments, date, CULTO_DIA.id)
          .filter((a) => a.roleId === CANTANTES.id);
        expect(cantantes).toHaveLength(1);
        expect(cantantes[0].memberId).toBe(CONI_G1.id);
      }
    });

    it("#37: round-robin matters with tight max and multiple eligible members", () => {
      const cantantesMax1: RoleDefinition = { id: 1, name: "Cantantes", requiredCount: 1 };
      const coniNoHolidays: MemberInfo = { ...CONI_G1, holidays: [] };

      // January
      const jan = generateGroupSchedule({
        dates: JAN_SUNDAYS,
        events: [CULTO_DIA],
        roles: [cantantesMax1],
        members: [coniNoHolidays, DANI_G1],
      });
      // Coni (alphabetically first) → 01-04, Dani → 01-11, Coni → 01-18, Dani → 01-25
      expect(jan.assignments[0].memberId).toBe(CONI_G1.id);
      expect(jan.assignments[1].memberId).toBe(DANI_G1.id);

      // Add third member for February
      const eli: MemberInfo = {
        id: 3, name: "Eli", roleIds: [1],
        availableDays: ["Domingo"],
        availabilityBlocksByDay: { Domingo: [{ startUtc: "09:00", endUtc: "13:00" }] },
        holidays: [],
      };
      const feb = generateGroupSchedule({
        dates: FEB_SUNDAYS,
        events: [CULTO_DIA],
        roles: [cantantesMax1],
        members: [coniNoHolidays, DANI_G1, eli],
        previousAssignments: jan.assignments,
      });
      // Pointer from Jan: after Dani → next is Coni (index 0, then wrapped)
      // With 3 members [Coni, Dani, Eli]: rotation continues
      expect(feb.assignments.length).toBe(FEB_SUNDAYS.length);
    });

    it("#38: new member joins in new month → enters rotation at end", () => {
      const cantantesMax1: RoleDefinition = { id: 1, name: "Cantantes", requiredCount: 1 };
      const coniNoHolidays: MemberInfo = { ...CONI_G1, holidays: [] };
      const jan = generateGroupSchedule({
        dates: JAN_SUNDAYS,
        events: [CULTO_DIA],
        roles: [cantantesMax1],
        members: [coniNoHolidays, DANI_G1],
      });

      const eli: MemberInfo = {
        id: 3, name: "Eli", roleIds: [1],
        availableDays: ["Domingo"],
        availabilityBlocksByDay: { Domingo: [{ startUtc: "09:00", endUtc: "13:00" }] },
        holidays: [],
      };
      const feb = generateGroupSchedule({
        dates: FEB_SUNDAYS,
        events: [CULTO_DIA],
        roles: [cantantesMax1],
        members: [coniNoHolidays, DANI_G1, eli],
        previousAssignments: jan.assignments,
      });
      // Eli should appear in February rotation
      const eliAssigned = feb.assignments.filter((a) => a.memberId === eli.id);
      expect(eliAssigned.length).toBeGreaterThan(0);
    });

    it("#39: changed availability between months alters eligibility", () => {
      // January: Dani available 09-21 → eligible for Culto Noche
      const jan = runG1January();
      const daniNocheJan = assignmentsForEvent(jan.assignments, CULTO_NOCHE.id)
        .filter((a) => a.memberId === DANI_G1.id);
      expect(daniNocheJan.length).toBeGreaterThan(0);

      // February: Dani's availability narrowed to 09-13 → no longer eligible for Culto Noche
      const daniNarrow: MemberInfo = {
        ...DANI_G1,
        availabilityBlocksByDay: {
          Domingo: [{ startUtc: "09:00", endUtc: "13:00" }],
          Miércoles: [{ startUtc: "18:00", endUtc: "21:00" }],
        },
      };
      const feb = generateGroupSchedule({
        dates: FEB_DATES,
        events: G1_EVENTS,
        roles: G1_ROLES,
        members: [CONI_G1, daniNarrow],
        previousAssignments: jan.assignments,
      });
      const daniNocheFeb = assignmentsForEvent(feb.assignments, CULTO_NOCHE.id)
        .filter((a) => a.memberId === DANI_G1.id);
      expect(daniNocheFeb).toHaveLength(0);
    });

    it("#40: uneven load doesn't auto-compensate if constraints unchanged", () => {
      const { jan, feb } = runJanThenFeb();
      // Dani covered all Jan holidays; Feb pattern identical — no catch-up for Coni
      // Verify Feb Culto Dia pattern matches Jan pre-holiday pattern
      const janPreHolidayDia = assignmentsForDateEvent(jan.assignments, "2026-01-04", CULTO_DIA.id)
        .map((a) => ({ r: a.roleId, m: a.memberId }))
        .sort((a, b) => a.r - b.r);
      for (const date of FEB_SUNDAYS) {
        const febDia = assignmentsForDateEvent(feb.assignments, date, CULTO_DIA.id)
          .map((a) => ({ r: a.roleId, m: a.memberId }))
          .sort((a, b) => a.r - b.r);
        expect(febDia).toEqual(janPreHolidayDia);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Schedule dates output
  // -----------------------------------------------------------------------
  describe("scheduleDates output", () => {
    it("emits one ScheduleDateOutput per event per date", () => {
      const result = runG1January();
      // Each Sunday should have 2 events (Culto Dia + Culto Noche)
      for (const date of JAN_SUNDAYS) {
        const sds = result.scheduleDates.filter((sd) => sd.date === date);
        expect(sds).toHaveLength(2);
        expect(sds.map((sd) => sd.recurringEventId).sort()).toEqual([CULTO_DIA.id, CULTO_NOCHE.id].sort());
      }
      // Each Wednesday should have 1 event
      for (const date of JAN_WEDNESDAYS) {
        const sds = result.scheduleDates.filter((sd) => sd.date === date);
        expect(sds).toHaveLength(1);
        expect(sds[0].recurringEventId).toBe(G1_WED.id);
      }
    });

    it("for_everyone events emit scheduleDates but no assignments", () => {
      const forEveryoneEvent: RecurringEventConfig = {
        id: 999, weekdayName: "Domingo", type: "for_everyone", label: "Ensayo General",
        startTimeUtc: "07:00", endTimeUtc: "08:00", rolePriorities: {},
      };
      const result = generateGroupSchedule({
        dates: ["2026-01-04"],
        events: [forEveryoneEvent, CULTO_DIA],
        roles: G1_ROLES,
        members: G1_MEMBERS,
      });
      const forEveryoneSd = result.scheduleDates.filter((sd) => sd.recurringEventId === 999);
      expect(forEveryoneSd).toHaveLength(1);
      expect(forEveryoneSd[0].type).toBe("for_everyone");
      const forEveryoneAssignments = result.assignments.filter((a) => a.recurringEventId === 999);
      expect(forEveryoneAssignments).toHaveLength(0);
    });

    it("getScheduleDates derives correct dates from events", () => {
      const activeDays = [...new Set(G1_EVENTS.map((e) => e.weekdayName))];
      const dates = getScheduleDates(1, 2026, activeDays);
      expect(dates).toEqual(JAN_DATES);
    });
  });
});

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

describe("when resolving holidays for a member", () => {
  const holidays = [
    { userId: "user-1", memberId: null, startDate: "2026-07-01", endDate: "2026-07-14" },
    { userId: null, memberId: 10, startDate: "2026-08-01", endDate: "2026-08-10" },
    { userId: "user-2", memberId: null, startDate: "2026-12-23", endDate: "2026-12-31" },
    { userId: null, memberId: 20, startDate: "2026-04-01", endDate: "2026-04-07" },
  ];

  it("linked member gets both user-level and member-level holidays", () => {
    const result = resolveHolidaysForMember({
      memberId: 10,
      linkedUserId: "user-1",
      allHolidays: holidays,
    });
    expect(result).toEqual([
      { startDate: "2026-07-01", endDate: "2026-07-14" },
      { startDate: "2026-08-01", endDate: "2026-08-10" },
    ]);
  });

  it("unlinked member gets only member-level holidays", () => {
    const result = resolveHolidaysForMember({
      memberId: 10,
      linkedUserId: null,
      allHolidays: holidays,
    });
    expect(result).toEqual([
      { startDate: "2026-08-01", endDate: "2026-08-10" },
    ]);
  });

  it("returns empty when no holidays match", () => {
    const result = resolveHolidaysForMember({
      memberId: 999,
      linkedUserId: "user-999",
      allHolidays: holidays,
    });
    expect(result).toEqual([]);
  });
});

describe("when filtering dates available for schedule rebuild", () => {
  it("keeps only dates on or after today", () => {
    const dates = ["2026-03-01", "2026-03-07", "2026-03-08", "2026-03-15"];
    expect(filterRebuildableDates(dates, "2026-03-07")).toEqual([
      "2026-03-07",
      "2026-03-08",
      "2026-03-15",
    ]);
  });

  it("returns empty when all dates are in the past", () => {
    expect(filterRebuildableDates(["2026-01-01", "2026-01-15"], "2026-03-01")).toEqual([]);
  });

  it("returns all dates when all are in the future", () => {
    const dates = ["2026-06-01", "2026-06-15"];
    expect(filterRebuildableDates(dates, "2026-03-01")).toEqual(dates);
  });
});

describe("when validating a date belongs to the schedule month", () => {
  it("accepts a date within the schedule month", () => {
    expect(validateDateInScheduleMonth({ date: "2026-03-15", month: 3, year: 2026 }))
      .toEqual({ valid: true });
  });

  it("rejects a date in a different month", () => {
    const result = validateDateInScheduleMonth({ date: "2026-04-01", month: 3, year: 2026 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/mes del cronograma/);
    }
  });

  it("rejects a date in a different year", () => {
    const result = validateDateInScheduleMonth({ date: "2025-03-15", month: 3, year: 2026 });
    expect(result.valid).toBe(false);
  });
});

describe("event default values", () => {
  it("provides sensible defaults for null DB fields", () => {
    expect(EVENT_DEFAULTS.label).toBe("Evento");
    expect(EVENT_DEFAULTS.startTimeUtc).toBe("00:00");
    expect(EVENT_DEFAULTS.endTimeUtc).toBe("23:59");
  });
});

// ---------------------------------------------------------------------------
// filterSchedulableRoles
// ---------------------------------------------------------------------------

describe("when filtering roles eligible for scheduling", () => {
  it("keeps independent roles and excludes dependent roles", () => {
    const roles = [
      { id: 1, name: "Cantantes", requiredCount: 3, exclusiveGroupId: 10, dependsOnRoleId: null },
      { id: 2, name: "Músicos", requiredCount: 2, exclusiveGroupId: null, dependsOnRoleId: null },
      { id: 3, name: "Coristas", requiredCount: 1, exclusiveGroupId: null, dependsOnRoleId: 1 },
    ];
    const result = filterSchedulableRoles(roles);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([1, 2]);
  });

  it("maps exclusiveGroupId correctly, defaulting null", () => {
    const roles = [
      { id: 1, name: "A", requiredCount: 1, exclusiveGroupId: 5 },
      { id: 2, name: "B", requiredCount: 1 },
    ];
    const result = filterSchedulableRoles(roles);
    expect(result[0].exclusiveGroupId).toBe(5);
    expect(result[1].exclusiveGroupId).toBeNull();
  });

  it("returns empty array when all roles are dependent", () => {
    const roles = [
      { id: 1, name: "Dep", requiredCount: 1, dependsOnRoleId: 99 },
    ];
    expect(filterSchedulableRoles(roles)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(filterSchedulableRoles([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDependentRoleIds / isDependentRole
// ---------------------------------------------------------------------------

describe("dependent role identification", () => {
  const roles = [
    { id: 1, dependsOnRoleId: null },
    { id: 2, dependsOnRoleId: 1 },
    { id: 3, dependsOnRoleId: null },
    { id: 4, dependsOnRoleId: 3 },
  ];

  it("getDependentRoleIds returns only roles with dependsOnRoleId", () => {
    const ids = getDependentRoleIds(roles);
    expect(ids).toEqual(new Set([2, 4]));
  });

  it("getDependentRoleIds returns empty set when no dependent roles exist", () => {
    expect(getDependentRoleIds([{ id: 1 }, { id: 2 }])).toEqual(new Set());
  });

  it("isDependentRole returns true for a dependent role", () => {
    expect(isDependentRole(2, roles)).toBe(true);
  });

  it("isDependentRole returns false for an independent role", () => {
    expect(isDependentRole(1, roles)).toBe(false);
  });

  it("isDependentRole returns false for a role that does not exist", () => {
    expect(isDependentRole(99, roles)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateDependentRoleAssignment
// ---------------------------------------------------------------------------

describe("dependent role assignment validation", () => {
  const roles = [
    { id: 1, dependsOnRoleId: null },
    { id: 2, dependsOnRoleId: 1 },
  ];

  it("valid when member is assigned to the source role on the same date", () => {
    const result = validateDependentRoleAssignment({
      roleId: 2,
      memberId: 10,
      roles,
      assignmentsOnDate: [{ roleId: 1, memberId: 10 }],
    });
    expect(result).toEqual({ valid: true });
  });

  it("invalid when member is not assigned to the source role", () => {
    const result = validateDependentRoleAssignment({
      roleId: 2,
      memberId: 10,
      roles,
      assignmentsOnDate: [{ roleId: 1, memberId: 99 }],
    });
    expect(result.valid).toBe(false);
  });

  it("invalid when another member holds the source role but not this member", () => {
    const result = validateDependentRoleAssignment({
      roleId: 2,
      memberId: 10,
      roles,
      assignmentsOnDate: [{ roleId: 1, memberId: 20 }],
    });
    expect(result.valid).toBe(false);
  });

  it("invalid when role is not a dependent role", () => {
    const result = validateDependentRoleAssignment({
      roleId: 1,
      memberId: 10,
      roles,
      assignmentsOnDate: [{ roleId: 1, memberId: 10 }],
    });
    expect(result.valid).toBe(false);
  });

  it("invalid when role does not exist", () => {
    const result = validateDependentRoleAssignment({
      roleId: 99,
      memberId: 10,
      roles,
      assignmentsOnDate: [],
    });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getEligibleMemberIds
// ---------------------------------------------------------------------------

describe("eligible member selection for a role on a date", () => {
  const members = [
    { id: 1, roleIds: [10, 20], availableDays: ["Sábado"] },
    { id: 2, roleIds: [10], availableDays: ["Sábado", "Domingo"] },
    { id: 3, roleIds: [10], availableDays: [] },
    { id: 4, roleIds: [20], availableDays: ["Sábado"] },
  ];

  it("includes members with the role who are available on that weekday", () => {
    // 2026-03-07 is a Saturday (sábado)
    const result = getEligibleMemberIds({
      role: { id: 10, dependsOnRoleId: null },
      date: "2026-03-07",
      members,
      assignmentsOnDate: [],
    });
    expect(result).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(result).not.toContain(4);
  });

  it("includes members with empty availableDays on any weekday", () => {
    // 2026-03-09 is a Monday (lunes); only member 3 has empty availableDays for role 10
    const result = getEligibleMemberIds({
      role: { id: 10, dependsOnRoleId: null },
      date: "2026-03-09",
      members,
      assignmentsOnDate: [],
    });
    expect(result).toContain(3);
  });

  it("excludes members not available on the weekday", () => {
    // 2026-03-09 is Monday; members 1 and 2 are only available on sábado/domingo
    const result = getEligibleMemberIds({
      role: { id: 10, dependsOnRoleId: null },
      date: "2026-03-09",
      members,
      assignmentsOnDate: [],
    });
    expect(result).not.toContain(1);
    expect(result).not.toContain(2);
  });

  it("for dependent roles, only includes members assigned to the source role", () => {
    const result = getEligibleMemberIds({
      role: { id: 20, dependsOnRoleId: 10 },
      date: "2026-03-07",
      members,
      assignmentsOnDate: [{ roleId: 10, memberId: 1 }],
    });
    expect(result).toEqual([1]);
  });

  it("for dependent roles, returns empty when no one is assigned to the source role", () => {
    const result = getEligibleMemberIds({
      role: { id: 20, dependsOnRoleId: 10 },
      date: "2026-03-07",
      members,
      assignmentsOnDate: [],
    });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeDatesWithGaps
// ---------------------------------------------------------------------------

describe("finding dates with unfilled role slots", () => {
  const roleDefinitions: RoleDefinition[] = [
    { id: 1, name: "Cantantes", requiredCount: 2 },
    { id: 2, name: "Músicos", requiredCount: 1 },
  ];

  it("returns dates where a role has fewer assignments than required", () => {
    const result = computeDatesWithGaps({
      dates: ["2026-03-07", "2026-03-14"],
      currentAssignments: [
        { date: "2026-03-07", roleId: 1 },
        { date: "2026-03-07", roleId: 1 },
        { date: "2026-03-07", roleId: 2 },
      ],
      roleDefinitions,
      dependentRoleIds: new Set(),
    });
    expect(result).toEqual(["2026-03-14"]);
  });

  it("returns empty when all dates are fully filled", () => {
    const result = computeDatesWithGaps({
      dates: ["2026-03-07"],
      currentAssignments: [
        { date: "2026-03-07", roleId: 1 },
        { date: "2026-03-07", roleId: 1 },
        { date: "2026-03-07", roleId: 2 },
      ],
      roleDefinitions,
      dependentRoleIds: new Set(),
    });
    expect(result).toEqual([]);
  });

  it("ignores dependent role assignments when counting filled slots", () => {
    const result = computeDatesWithGaps({
      dates: ["2026-03-07"],
      currentAssignments: [
        { date: "2026-03-07", roleId: 1 },
        { date: "2026-03-07", roleId: 1 },
        { date: "2026-03-07", roleId: 2 },
        { date: "2026-03-07", roleId: 3 },
      ],
      roleDefinitions,
      dependentRoleIds: new Set([3]),
    });
    expect(result).toEqual([]);
  });

  it("returns empty for empty dates", () => {
    expect(
      computeDatesWithGaps({
        dates: [],
        currentAssignments: [],
        roleDefinitions,
        dependentRoleIds: new Set(),
      })
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// applyPreferredSlots
// ---------------------------------------------------------------------------

describe("preferred member slot allocation", () => {
  const assignments = [
    { date: "2026-03-07", roleId: 1, memberId: 10 },
    { date: "2026-03-07", roleId: 2, memberId: 20 },
    { date: "2026-03-14", roleId: 1, memberId: 30 },
    { date: "2026-03-14", roleId: 2, memberId: 40 },
  ];

  it("fills preferred slots up to maxSlots, displacing scheduler assignments", () => {
    const result = applyPreferredSlots({
      preferredMemberId: 99,
      preferredRoleIds: [1],
      maxSlots: 2,
      dates: ["2026-03-07", "2026-03-14"],
      assignments,
    });
    expect(result.preferred).toHaveLength(2);
    expect(result.preferred[0]).toEqual({ date: "2026-03-07", roleId: 1, memberId: 99 });
    expect(result.preferred[1]).toEqual({ date: "2026-03-14", roleId: 1, memberId: 99 });
    expect(result.remaining).toHaveLength(2);
    expect(result.remaining.map((a) => a.memberId)).toEqual([20, 40]);
  });

  it("round-robins across multiple preferred roles", () => {
    const result = applyPreferredSlots({
      preferredMemberId: 99,
      preferredRoleIds: [1, 2],
      maxSlots: 2,
      dates: ["2026-03-07", "2026-03-14"],
      assignments,
    });
    expect(result.preferred[0].roleId).toBe(1);
    expect(result.preferred[1].roleId).toBe(2);
  });

  it("does nothing when maxSlots is 0", () => {
    const result = applyPreferredSlots({
      preferredMemberId: 99,
      preferredRoleIds: [1],
      maxSlots: 0,
      dates: ["2026-03-07"],
      assignments,
    });
    expect(result.preferred).toEqual([]);
    expect(result.remaining).toEqual(assignments);
  });

  it("does nothing when preferredRoleIds is empty", () => {
    const result = applyPreferredSlots({
      preferredMemberId: 99,
      preferredRoleIds: [],
      maxSlots: 5,
      dates: ["2026-03-07"],
      assignments,
    });
    expect(result.preferred).toEqual([]);
    expect(result.remaining).toEqual(assignments);
  });

  it("caps slots at the number of dates available", () => {
    const result = applyPreferredSlots({
      preferredMemberId: 99,
      preferredRoleIds: [1],
      maxSlots: 100,
      dates: ["2026-03-07"],
      assignments,
    });
    expect(result.preferred).toHaveLength(1);
  });
});
