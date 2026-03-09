import { generateSchedule } from "@/lib/scheduler";
import {
  MemberInfo,
  RoleDefinition,
  ScheduleAssignment,
} from "@/lib/scheduler-types";

function makeRole(id: number, name: string, requiredCount = 1): RoleDefinition {
  return { id, name, requiredCount };
}

function makeMember(
  id: number,
  name: string,
  roleIds: number[],
  availableDays: string[] = ["Miércoles", "Viernes", "Domingo"],
  holidays: MemberInfo["holidays"] = [],
  availabilityBlocksByDay?: MemberInfo["availabilityBlocksByDay"],
): MemberInfo {
  const m: MemberInfo = { id, name, roleIds, availableDays, holidays };
  if (availabilityBlocksByDay) m.availabilityBlocksByDay = availabilityBlocksByDay;
  return m;
}

const LEADER = makeRole(1, "Leader");
const KEYBOARD = makeRole(2, "Keyboard", 2);
const ELECTRIC_GUITAR = makeRole(3, "Electric Guitar");
const ACOUSTIC_GUITAR = makeRole(4, "Acoustic Guitar");
const BASS = makeRole(5, "Bass");
const DRUMS = makeRole(6, "Drums");
const VOICE = makeRole(7, "Voice", 4);

describe("Schedule generation", () => {
  describe("when assigning members to roles", () => {
    it("assigns one member per slot for a single-date, single-role schedule", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [makeMember(1, "Alice", [1])];

      const result = generateSchedule({
        dates: ["2026-03-04"], // Wednesday
        roles,
        members,
      });

      expect(result.assignments).toEqual([
        { date: "2026-03-04", roleId: 1, memberId: 1 },
      ]);
      expect(result.unfilledSlots).toEqual([]);
    });

    it("fills multiple slots when a role requires more than one person", () => {
      const roles = [makeRole(2, "Keyboard", 2)];
      const members = [makeMember(1, "Alice", [2]), makeMember(2, "Bob", [2])];

      const result = generateSchedule({
        dates: ["2026-03-04"],
        roles,
        members,
      });

      expect(result.assignments).toHaveLength(2);
      const assignedIds = result.assignments.map((a) => a.memberId).sort();
      expect(assignedIds).toEqual([1, 2]);
    });

    it("does not assign the same person to two roles in the same exclusive group on the same date", () => {
      const roles: RoleDefinition[] = [
        { id: 1, name: "Keyboard", requiredCount: 1, exclusiveGroupId: 1 },
        { id: 2, name: "Guitar", requiredCount: 1, exclusiveGroupId: 1 },
      ];
      const members = [
        makeMember(1, "Alice", [1, 2]),
        makeMember(2, "Bob", [1, 2]),
      ];

      const result = generateSchedule({
        dates: ["2026-03-04"],
        roles,
        members,
      });

      const idsOnDate = result.assignments.map((a) => a.memberId);
      const uniqueIds = new Set(idsOnDate);
      expect(uniqueIds.size).toBe(idsOnDate.length);
    });
  });

  describe("when rotating members fairly", () => {
    it("distributes assignments evenly across multiple dates", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(1, "Alice", [1]),
        makeMember(2, "Bob", [1]),
        makeMember(3, "Charlie", [1]),
      ];

      const result = generateSchedule({
        dates: ["2026-03-04", "2026-03-11", "2026-03-18"], // all Wednesdays
        roles,
        members,
      });

      // Each of the 3 members should be assigned exactly once
      const counts = new Map<number, number>();
      for (const a of result.assignments) {
        counts.set(a.memberId, (counts.get(a.memberId) ?? 0) + 1);
      }
      expect(counts.get(1)).toBe(1);
      expect(counts.get(2)).toBe(1);
      expect(counts.get(3)).toBe(1);
    });

    it("wraps around the rotation when there are more dates than members", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [makeMember(1, "Alice", [1]), makeMember(2, "Bob", [1])];

      const result = generateSchedule({
        dates: ["2026-03-04", "2026-03-11", "2026-03-18", "2026-03-25"], // all Wednesdays
        roles,
        members,
      });

      const counts = new Map<number, number>();
      for (const a of result.assignments) {
        counts.set(a.memberId, (counts.get(a.memberId) ?? 0) + 1);
      }
      // 4 dates, 2 members → each gets 2
      expect(counts.get(1)).toBe(2);
      expect(counts.get(2)).toBe(2);
    });

    it("considers previous assignments to continue a fair rotation", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(1, "Alice", [1]),
        makeMember(2, "Bob", [1]),
        makeMember(3, "Charlie", [1]),
      ];

      // Alice and Bob already played on previous Wednesdays
      const previousAssignments: ScheduleAssignment[] = [
        { date: "2026-02-04", roleId: 1, memberId: 1 }, // Alice on Wed
        { date: "2026-02-11", roleId: 1, memberId: 2 }, // Bob on Wed
      ];

      const result = generateSchedule({
        dates: ["2026-03-04"], // Wednesday
        roles,
        members,
        previousAssignments,
      });

      // Charlie should be picked — the Wednesday pointer is after Bob → Charlie
      expect(result.assignments[0].memberId).toBe(3);
    });
  });

  describe("when members have limited availability", () => {
    it("only assigns members to days they are available", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(1, "Alice", [1], ["Miércoles"]),
        makeMember(2, "Bob", [1], ["Viernes"]),
        makeMember(3, "Charlie", [1], ["Domingo"]),
      ];

      const result = generateSchedule({
        dates: [
          "2026-03-04", // Wednesday
          "2026-03-06", // Friday
          "2026-03-08", // Sunday
        ],
        roles,
        members,
      });

      expect(result.assignments).toEqual(
        expect.arrayContaining([
          { date: "2026-03-04", roleId: 1, memberId: 1 }, // Alice on Wed
          { date: "2026-03-06", roleId: 1, memberId: 2 }, // Bob on Fri
          { date: "2026-03-08", roleId: 1, memberId: 3 }, // Charlie on Sun
        ]),
      );
    });

    it("skips members who are not available on a given day of the week", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(1, "Alice", [1], ["Miércoles"]),
        makeMember(2, "Bob", [1], ["Miércoles", "Viernes"]),
      ];

      const result = generateSchedule({
        dates: ["2026-03-06"], // Friday
        roles,
        members,
      });

      // Only Bob is available on Fridays
      expect(result.assignments).toEqual([
        { date: "2026-03-06", roleId: 1, memberId: 2 },
      ]);
    });
  });

  describe("when members are on holiday", () => {
    it("does not assign a member during their holiday period", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles", "Viernes", "Domingo"],
          [{ startDate: "2026-03-01", endDate: "2026-03-07" }],
        ),
        makeMember(2, "Bob", [1]),
      ];

      const result = generateSchedule({
        dates: [
          "2026-03-04", // Wednesday - Alice on holiday
          "2026-03-08", // Sunday - Alice available again
        ],
        roles,
        members,
      });

      const wednesdayAssignment = result.assignments.find(
        (a) => a.date === "2026-03-04",
      );
      const sundayAssignment = result.assignments.find(
        (a) => a.date === "2026-03-08",
      );

      expect(wednesdayAssignment?.memberId).toBe(2); // Bob fills in
      expect(sundayAssignment?.memberId).toBe(1); // Alice is back
    });

    it("handles a holiday that spans exactly one day", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles"],
          [{ startDate: "2026-03-04", endDate: "2026-03-04" }],
        ),
        makeMember(2, "Bob", [1]),
      ];

      const result = generateSchedule({
        dates: ["2026-03-04"],
        roles,
        members,
      });

      expect(result.assignments[0].memberId).toBe(2);
    });
  });

  describe("when there are not enough eligible members", () => {
    it("reports unfilled slots when no one can play a role on a date", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(1, "Alice", [1], ["Viernes"]), // Not available on Wednesday
      ];

      const result = generateSchedule({
        dates: ["2026-03-04"], // Wednesday
        roles,
        members,
      });

      expect(result.assignments).toEqual([]);
      expect(result.unfilledSlots).toEqual([{ date: "2026-03-04", roleId: 1 }]);
    });

    it("partially fills slots when some but not enough members are available", () => {
      const roles = [makeRole(2, "Keyboard", 2)];
      const members = [makeMember(1, "Alice", [2])];

      const result = generateSchedule({
        dates: ["2026-03-04"],
        roles,
        members,
      });

      expect(result.assignments).toHaveLength(1);
      expect(result.unfilledSlots).toHaveLength(1);
      expect(result.unfilledSlots[0]).toEqual({
        date: "2026-03-04",
        roleId: 2,
      });
    });
  });

  describe("when dealing with a realistic full-band scenario", () => {
    it("generates a complete schedule for a month with all roles filled", () => {
      const roles = [
        LEADER,
        KEYBOARD,
        ELECTRIC_GUITAR,
        ACOUSTIC_GUITAR,
        BASS,
        DRUMS,
        VOICE,
      ];

      // Create enough members for each role
      const members: MemberInfo[] = [
        // Leaders
        makeMember(1, "Leader A", [1]),
        makeMember(2, "Leader B", [1]),
        // Keyboard players
        makeMember(3, "Keys A", [2]),
        makeMember(4, "Keys B", [2]),
        makeMember(5, "Keys C", [2]),
        // Electric guitar
        makeMember(6, "E.Guitar A", [3]),
        makeMember(7, "E.Guitar B", [3]),
        // Acoustic guitar
        makeMember(8, "A.Guitar A", [4]),
        makeMember(9, "A.Guitar B", [4]),
        // Bass
        makeMember(10, "Bass A", [5]),
        makeMember(11, "Bass B", [5]),
        // Drums
        makeMember(12, "Drums A", [6]),
        makeMember(13, "Drums B", [6]),
        // Voices
        makeMember(14, "Voice A", [7]),
        makeMember(15, "Voice B", [7]),
        makeMember(16, "Voice C", [7]),
        makeMember(17, "Voice D", [7]),
        makeMember(18, "Voice E", [7]),
      ];

      // March 2026: Wed 4, Fri 6, Sun 8, Wed 11, Fri 13, Sun 15, ...
      const marchDates = [
        "2026-03-04",
        "2026-03-06",
        "2026-03-08",
        "2026-03-11",
        "2026-03-13",
        "2026-03-15",
        "2026-03-18",
        "2026-03-20",
        "2026-03-22",
        "2026-03-25",
        "2026-03-27",
        "2026-03-29",
      ];

      const result = generateSchedule({
        dates: marchDates,
        roles,
        members,
      });

      // Total slots per date: 1 + 2 + 1 + 1 + 1 + 1 + 4 = 11
      const expectedTotal = marchDates.length * 11;
      expect(result.assignments).toHaveLength(expectedTotal);
      expect(result.unfilledSlots).toHaveLength(0);

      // Verify no member is assigned twice on the same date
      for (const date of marchDates) {
        const assignmentsOnDate = result.assignments.filter(
          (a) => a.date === date,
        );
        const memberIds = assignmentsOnDate.map((a) => a.memberId);
        expect(new Set(memberIds).size).toBe(memberIds.length);
      }
    });
  });

  describe("when members can play multiple roles", () => {
    it("assigns a multi-role member to only one role per date when roles share an exclusive group", () => {
      const roles: RoleDefinition[] = [
        { id: 1, name: "Keyboard", requiredCount: 1, exclusiveGroupId: 1 },
        {
          id: 3,
          name: "Electric Guitar",
          requiredCount: 1,
          exclusiveGroupId: 1,
        },
      ];
      const members = [
        makeMember(1, "Alice", [1, 3]), // Can play keyboard and guitar
        makeMember(2, "Bob", [1]),
        makeMember(3, "Charlie", [3]),
      ];

      const result = generateSchedule({
        dates: ["2026-03-04"],
        roles,
        members,
      });

      // Alice should appear at most once (exclusive group prevents double assignment)
      const aliceAssignments = result.assignments.filter(
        (a) => a.memberId === 1,
      );
      expect(aliceAssignments.length).toBeLessThanOrEqual(1);

      // Both roles should be filled
      expect(result.assignments).toHaveLength(2);
      expect(result.unfilledSlots).toHaveLength(0);
    });
  });

  describe("when roles have day-level priorities", () => {
    it("fills higher-priority roles first for a given day of the week", () => {
      // On Wednesdays, Acoustic Guitar (priority 0) should be filled before
      // Electric Guitar (priority 1). This matters when a member can play both
      // and roles are in the same exclusive group.
      const roles: RoleDefinition[] = [
        {
          id: 3,
          name: "Electric Guitar",
          requiredCount: 1,
          exclusiveGroupId: 1,
        },
        {
          id: 4,
          name: "Acoustic Guitar",
          requiredCount: 1,
          exclusiveGroupId: 1,
        },
      ];
      const members = [
        makeMember(1, "Alice", [3, 4]), // Can play both guitars
        makeMember(2, "Bob", [3]), // Only electric
      ];

      const result = generateSchedule({
        dates: ["2026-03-04"], // Wednesday
        roles,
        members,
        dayRolePriorities: {
          Miércoles: { 4: 0, 3: 1 }, // Acoustic first, Electric second
        },
      });

      // Alice should be assigned to Acoustic Guitar (higher priority)
      // Bob should fill Electric Guitar
      const acousticAssignment = result.assignments.find((a) => a.roleId === 4);
      const electricAssignment = result.assignments.find((a) => a.roleId === 3);

      expect(acousticAssignment?.memberId).toBe(1);
      expect(electricAssignment?.memberId).toBe(2);
      expect(result.unfilledSlots).toHaveLength(0);
    });

    it("uses default role order when no priorities are set for a day", () => {
      const roles = [
        makeRole(3, "Electric Guitar"),
        makeRole(4, "Acoustic Guitar"),
      ];
      const members = [
        makeMember(1, "Alice", [3, 4]),
        makeMember(2, "Bob", [4]),
      ];

      const result = generateSchedule({
        dates: ["2026-03-06"], // Friday — no priorities set
        roles,
        members,
        dayRolePriorities: {
          Miércoles: { 4: 0, 3: 1 },
        },
      });

      // Without priorities, default order applies (Electric first since listed first)
      expect(result.assignments).toHaveLength(2);
      expect(result.unfilledSlots).toHaveLength(0);
    });
  });

  describe("exclusive role groups", () => {
    it("allows a member to fill roles in different groups on the same date", () => {
      // Voice has no exclusive group, Keyboard has "Instrumento"
      const roles: RoleDefinition[] = [
        { id: 1, name: "Voice", requiredCount: 1 },
        { id: 2, name: "Keyboard", requiredCount: 1, exclusiveGroupId: 1 },
      ];
      const members = [makeMember(1, "David", [1, 2])];

      const result = generateSchedule({
        dates: ["2026-03-04"], // Wednesday
        roles,
        members,
      });

      // David should be assigned to both Voice and Keyboard
      expect(result.assignments).toHaveLength(2);
      expect(result.unfilledSlots).toHaveLength(0);
      expect(result.assignments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ roleId: 1, memberId: 1 }),
          expect.objectContaining({ roleId: 2, memberId: 1 }),
        ]),
      );
    });

    it("prevents a member from filling two roles in the same exclusive group on the same date", () => {
      // Both Keyboard and Electric Guitar are in "Instrumento" group
      const roles: RoleDefinition[] = [
        { id: 1, name: "Keyboard", requiredCount: 1, exclusiveGroupId: 1 },
        {
          id: 2,
          name: "Electric Guitar",
          requiredCount: 1,
          exclusiveGroupId: 1,
        },
      ];
      // David can play both but should only get one
      const members = [
        makeMember(1, "David", [1, 2]),
        makeMember(2, "Bob", [2]),
      ];

      const result = generateSchedule({
        dates: ["2026-03-04"], // Wednesday
        roles,
        members,
      });

      // David gets Keyboard (first role), Bob gets Electric Guitar
      expect(result.assignments).toHaveLength(2);
      expect(result.unfilledSlots).toHaveLength(0);
      const davidAssignments = result.assignments.filter(
        (a) => a.memberId === 1,
      );
      const bobAssignments = result.assignments.filter((a) => a.memberId === 2);
      expect(davidAssignments).toHaveLength(1);
      expect(bobAssignments).toHaveLength(1);
      expect(davidAssignments[0].roleId).toBe(1); // David got Keyboard
      expect(bobAssignments[0].roleId).toBe(2); // Bob got Electric Guitar
    });

    it("allows a member to fill multiple roles when none have an exclusive group", () => {
      // Two roles with no exclusive group
      const roles: RoleDefinition[] = [
        { id: 1, name: "Voice", requiredCount: 1 },
        { id: 2, name: "Leader", requiredCount: 1 },
      ];
      const members = [makeMember(1, "David", [1, 2])];

      const result = generateSchedule({
        dates: ["2026-03-04"], // Wednesday
        roles,
        members,
      });

      // David should be assigned to both
      expect(result.assignments).toHaveLength(2);
      expect(result.unfilledSlots).toHaveLength(0);
      expect(result.assignments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ roleId: 1, memberId: 1 }),
          expect.objectContaining({ roleId: 2, memberId: 1 }),
        ]),
      );
    });

    it("reports unfilled slot when exclusive group blocks the only candidate", () => {
      // Both roles in "Instrumento" group, only one member
      const roles: RoleDefinition[] = [
        { id: 1, name: "Keyboard", requiredCount: 1, exclusiveGroupId: 1 },
        {
          id: 2,
          name: "Electric Guitar",
          requiredCount: 1,
          exclusiveGroupId: 1,
        },
      ];
      const members = [makeMember(1, "David", [1, 2])];

      const result = generateSchedule({
        dates: ["2026-03-04"], // Wednesday
        roles,
        members,
      });

      // David gets Keyboard, Electric Guitar is unfilled
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0]).toEqual(
        expect.objectContaining({ roleId: 1, memberId: 1 }),
      );
      expect(result.unfilledSlots).toHaveLength(1);
      expect(result.unfilledSlots[0]).toEqual(
        expect.objectContaining({ roleId: 2 }),
      );
    });
  });

  describe("when events have a time window", () => {
    it("assigns a member whose availability block overlaps the event window", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles"],
          [],
          { Miércoles: [{ startUtc: "09:00", endUtc: "12:00" }] },
        ),
      ];

      const result = generateSchedule({
        dates: ["2026-03-04"], // Wednesday
        roles,
        members,
        dayEventTimeWindow: {
          Miércoles: { startUtc: "09:00", endUtc: "12:00" },
        },
      });

      expect(result.assignments).toEqual([
        { date: "2026-03-04", roleId: 1, memberId: 1 },
      ]);
      expect(result.unfilledSlots).toEqual([]);
    });

    it("assigns a member when their block partially overlaps the event window", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles"],
          [],
          { Miércoles: [{ startUtc: "08:00", endUtc: "10:00" }] },
        ),
      ];

      const result = generateSchedule({
        dates: ["2026-03-04"],
        roles,
        members,
        dayEventTimeWindow: {
          Miércoles: { startUtc: "09:00", endUtc: "12:00" },
        },
      });

      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].memberId).toBe(1);
    });

    it("does not assign a member when their availability does not overlap the event window", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles"],
          [],
          { Miércoles: [{ startUtc: "14:00", endUtc: "18:00" }] },
        ),
        makeMember(
          2,
          "Bob",
          [1],
          ["Miércoles"],
          [],
          { Miércoles: [{ startUtc: "09:00", endUtc: "12:00" }] },
        ),
      ];

      const result = generateSchedule({
        dates: ["2026-03-04"],
        roles,
        members,
        dayEventTimeWindow: {
          Miércoles: { startUtc: "09:00", endUtc: "12:00" },
        },
      });

      expect(result.assignments).toEqual([
        { date: "2026-03-04", roleId: 1, memberId: 2 },
      ]);
    });

    it("does not assign a member who has no availability blocks on that day", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(1, "Alice", [1], ["Miércoles"], [], {
          Miércoles: [], // available on day but no time blocks
        }),
      ];

      const result = generateSchedule({
        dates: ["2026-03-04"],
        roles,
        members,
        dayEventTimeWindow: {
          Miércoles: { startUtc: "09:00", endUtc: "12:00" },
        },
      });

      expect(result.assignments).toEqual([]);
      expect(result.unfilledSlots).toEqual([{ date: "2026-03-04", roleId: 1 }]);
    });

    it("assigns a member when any of their multiple blocks overlaps the event window", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles"],
          [],
          {
            Miércoles: [
              { startUtc: "08:00", endUtc: "09:00" },
              { startUtc: "11:00", endUtc: "13:00" },
            ],
          },
        ),
      ];

      const result = generateSchedule({
        dates: ["2026-03-04"],
        roles,
        members,
        dayEventTimeWindow: {
          Miércoles: { startUtc: "09:00", endUtc: "12:00" },
        },
      });

      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].memberId).toBe(1);
    });

    it("ignores event time window for days not in dayEventTimeWindow", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles", "Viernes"],
          [],
          {
            Miércoles: [{ startUtc: "09:00", endUtc: "12:00" }],
            // Viernes not in availabilityBlocksByDay would fail if we required blocks for all days;
            // but dayEventTimeWindow has only Miércoles, so Friday has no time filter.
          },
        ),
      ];

      const result = generateSchedule({
        dates: ["2026-03-04", "2026-03-06"], // Wednesday, Friday
        roles,
        members,
        dayEventTimeWindow: {
          Miércoles: { startUtc: "09:00", endUtc: "12:00" },
          // Viernes not in map → full day, no time filter
        },
      });

      expect(result.assignments).toHaveLength(2);
      expect(result.assignments.find((a) => a.date === "2026-03-04")?.memberId).toBe(1);
      expect(result.assignments.find((a) => a.date === "2026-03-06")?.memberId).toBe(1);
    });
  });

  describe("event time window edge cases", () => {
    const wed = "2026-03-04";

    it("does not overlap when block ends exactly when event starts", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles"],
          [],
          { Miércoles: [{ startUtc: "06:00", endUtc: "09:00" }] },
        ),
      ];
      const result = generateSchedule({
        dates: [wed],
        roles,
        members,
        dayEventTimeWindow: { Miércoles: { startUtc: "09:00", endUtc: "12:00" } },
      });
      expect(result.assignments).toHaveLength(0);
      expect(result.unfilledSlots).toEqual([{ date: wed, roleId: 1 }]);
    });

    it("does not overlap when block starts exactly when event ends", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles"],
          [],
          { Miércoles: [{ startUtc: "12:00", endUtc: "15:00" }] },
        ),
      ];
      const result = generateSchedule({
        dates: [wed],
        roles,
        members,
        dayEventTimeWindow: { Miércoles: { startUtc: "09:00", endUtc: "12:00" } },
      });
      expect(result.assignments).toHaveLength(0);
      expect(result.unfilledSlots).toEqual([{ date: wed, roleId: 1 }]);
    });

    it("overlaps when block is fully inside event window", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles"],
          [],
          { Miércoles: [{ startUtc: "10:00", endUtc: "11:00" }] },
        ),
      ];
      const result = generateSchedule({
        dates: [wed],
        roles,
        members,
        dayEventTimeWindow: { Miércoles: { startUtc: "09:00", endUtc: "12:00" } },
      });
      expect(result.assignments).toEqual([{ date: wed, roleId: 1, memberId: 1 }]);
    });

    it("overlaps when event window is fully inside block", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles"],
          [],
          { Miércoles: [{ startUtc: "08:00", endUtc: "13:00" }] },
        ),
      ];
      const result = generateSchedule({
        dates: [wed],
        roles,
        members,
        dayEventTimeWindow: { Miércoles: { startUtc: "09:00", endUtc: "12:00" } },
      });
      expect(result.assignments).toEqual([{ date: wed, roleId: 1, memberId: 1 }]);
    });

    it("overlaps when there is only a one-minute overlap", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles"],
          [],
          { Miércoles: [{ startUtc: "09:59", endUtc: "11:00" }] },
        ),
      ];
      const result = generateSchedule({
        dates: [wed],
        roles,
        members,
        dayEventTimeWindow: { Miércoles: { startUtc: "09:00", endUtc: "10:00" } },
      });
      expect(result.assignments).toEqual([{ date: wed, roleId: 1, memberId: 1 }]);
    });

    it("overlaps for midnight-to-early-morning window", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles"],
          [],
          { Miércoles: [{ startUtc: "00:00", endUtc: "06:00" }] },
        ),
      ];
      const result = generateSchedule({
        dates: [wed],
        roles,
        members,
        dayEventTimeWindow: { Miércoles: { startUtc: "00:00", endUtc: "06:00" } },
      });
      expect(result.assignments).toEqual([{ date: wed, roleId: 1, memberId: 1 }]);
    });

    it("does not assign when member has blocks only for a different day", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles", "Viernes"],
          [],
          {
            Viernes: [{ startUtc: "09:00", endUtc: "12:00" }],
            // No Miércoles key → no blocks on Wednesday
          },
        ),
      ];
      const result = generateSchedule({
        dates: [wed],
        roles,
        members,
        dayEventTimeWindow: { Miércoles: { startUtc: "09:00", endUtc: "12:00" } },
      });
      expect(result.assignments).toHaveLength(0);
      expect(result.unfilledSlots).toEqual([{ date: wed, roleId: 1 }]);
    });

    it("when dayEventTimeWindow is empty, does not require availability blocks", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [makeMember(1, "Alice", [1], ["Miércoles"])];

      const result = generateSchedule({
        dates: [wed],
        roles,
        members,
        dayEventTimeWindow: {},
      });

      expect(result.assignments).toEqual([{ date: wed, roleId: 1, memberId: 1 }]);
    });

    it("when dayEventTimeWindow is omitted, does not require availability blocks", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [makeMember(1, "Alice", [1], ["Miércoles"])];

      const result = generateSchedule({
        dates: [wed],
        roles,
        members,
      });

      expect(result.assignments).toEqual([{ date: wed, roleId: 1, memberId: 1 }]);
    });

    it("late evening block overlapping event window", () => {
      const roles = [makeRole(1, "Leader")];
      const members = [
        makeMember(
          1,
          "Alice",
          [1],
          ["Miércoles"],
          [],
          { Miércoles: [{ startUtc: "20:00", endUtc: "23:59" }] },
        ),
      ];
      const result = generateSchedule({
        dates: [wed],
        roles,
        members,
        dayEventTimeWindow: { Miércoles: { startUtc: "20:00", endUtc: "22:00" } },
      });
      expect(result.assignments).toEqual([{ date: wed, roleId: 1, memberId: 1 }]);
    });
  });
});

/**
 * Tests for all 40 scheduling algorithm scenarios.
 * Setup: two users (Coni, Dani), two groups (CCMDV, Iglesia Central),
 * multiple concurrent events with time windows, exclusive groups, and cross-month continuity.
 *
 * Scenarios 19, 22 require cross-event exclusive-group tracking on the same date
 * (not currently supported by the scheduler which processes one event per call).
 */
describe("Scheduling algorithm scenarios", () => {
  const CANTANTES: RoleDefinition = { id: 1, name: "Cantantes", requiredCount: 4 };
  const MUSICOS: RoleDefinition = { id: 2, name: "Músicos", requiredCount: 2 };
  const CANTANTES_EX: RoleDefinition = { ...CANTANTES, exclusiveGroupId: 1 };
  const MUSICOS_EX: RoleDefinition = { ...MUSICOS, exclusiveGroupId: 1 };
  const ADORACION: RoleDefinition = { id: 3, name: "Adoración", requiredCount: 2 };

  const coniG1: MemberInfo = {
    id: 1,
    name: "Coni",
    roleIds: [1],
    availableDays: ["Domingo"],
    holidays: [{ startDate: "2026-01-15", endDate: "2026-01-31" }],
    availabilityBlocksByDay: {
      Domingo: [{ startUtc: "09:00", endUtc: "13:00" }],
    },
  };

  const daniG1: MemberInfo = {
    id: 2,
    name: "Dani",
    roleIds: [1, 2],
    availableDays: ["Domingo", "Miércoles"],
    holidays: [],
    availabilityBlocksByDay: {
      Domingo: [{ startUtc: "09:00", endUtc: "21:00" }],
      Miércoles: [{ startUtc: "18:00", endUtc: "21:00" }],
    },
  };

  const coniG2: MemberInfo = {
    id: 1,
    name: "Coni",
    roleIds: [3],
    availableDays: ["Miércoles", "Domingo"],
    holidays: [{ startDate: "2026-01-15", endDate: "2026-01-31" }],
    availabilityBlocksByDay: {
      Miércoles: [{ startUtc: "18:00", endUtc: "21:00" }],
      Domingo: [{ startUtc: "08:00", endUtc: "17:00" }],
    },
  };

  const CULTO_DIA_TW = { Domingo: { startUtc: "09:00", endUtc: "13:00" } };
  const CULTO_NOCHE_TW = { Domingo: { startUtc: "19:00", endUtc: "21:00" } };
  const REUNION_AM_TW = { Domingo: { startUtc: "10:00", endUtc: "12:00" } };

  const CULTO_DIA_PRIO = { Domingo: { 2: 0, 1: 1 } };
  const CULTO_NOCHE_PRIO = { Domingo: { 1: 0, 2: 1 } };

  const SUN_0104 = "2026-01-04";
  const SUN_0111 = "2026-01-11";
  const SUN_0118 = "2026-01-18";
  const SUN_0125 = "2026-01-25";
  const WED_0107 = "2026-01-07";
  const WED_0121 = "2026-01-21";
  const JAN_SUNDAYS = [SUN_0104, SUN_0111, SUN_0118, SUN_0125];

  const SUN_0201 = "2026-02-01";
  const SUN_0208 = "2026-02-08";
  const SUN_0215 = "2026-02-15";
  const SUN_0222 = "2026-02-22";
  const FEB_SUNDAYS = [SUN_0201, SUN_0208, SUN_0215, SUN_0222];

  describe("Eligibility (scenarios 1–9)", () => {
    it("#1 member with matching role, no holidays, and availability that matches event time is eligible", () => {
      const result = generateSchedule({
        dates: [SUN_0104],
        roles: [{ ...CANTANTES, requiredCount: 1 }],
        members: [coniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });
      expect(result.assignments).toEqual([
        { date: SUN_0104, roleId: 1, memberId: 1 },
      ]);
    });

    it("#2 member whose availability is wider than the event window is still eligible", () => {
      const result = generateSchedule({
        dates: [SUN_0104],
        roles: [{ ...CANTANTES, requiredCount: 1 }],
        members: [daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });
      expect(result.assignments).toEqual([
        { date: SUN_0104, roleId: 1, memberId: 2 },
      ]);
    });

    it("#3 member holding multiple roles gets assigned to each of them", () => {
      const result = generateSchedule({
        dates: [SUN_0104],
        roles: [
          { ...CANTANTES, requiredCount: 1 },
          { ...MUSICOS, requiredCount: 1 },
        ],
        members: [daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
      });
      const roleIds = result.assignments.map((a) => a.roleId).sort();
      expect(roleIds).toEqual([1, 2]);
      expect(result.assignments.every((a) => a.memberId === 2)).toBe(true);
    });

    it("#4 member with no holidays is eligible for every date their availability covers", () => {
      const result = generateSchedule({
        dates: JAN_SUNDAYS,
        roles: [{ ...CANTANTES, requiredCount: 1 }],
        members: [daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });
      expect(result.assignments).toHaveLength(4);
      expect(result.assignments.every((a) => a.memberId === 2)).toBe(true);
    });

    it("#5 member with no availability on a day of the week is not eligible for that day", () => {
      const result = generateSchedule({
        dates: [WED_0107],
        roles: [{ ...CANTANTES, requiredCount: 1 }],
        members: [coniG1],
      });
      expect(result.assignments).toEqual([]);
      expect(result.unfilledSlots).toEqual([{ date: WED_0107, roleId: 1 }]);
    });

    it("#6 member available on the day but outside the event time window is not eligible", () => {
      const result = generateSchedule({
        dates: [SUN_0104],
        roles: [{ ...CANTANTES, requiredCount: 1 }],
        members: [coniG1],
        dayEventTimeWindow: CULTO_NOCHE_TW,
      });
      expect(result.assignments).toEqual([]);
      expect(result.unfilledSlots).toEqual([{ date: SUN_0104, roleId: 1 }]);
    });

    it("#7 member on holidays is not eligible even when their availability matches the event", () => {
      const result = generateSchedule({
        dates: [SUN_0118],
        roles: [{ ...CANTANTES, requiredCount: 1 }],
        members: [coniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });
      expect(result.assignments).toEqual([]);
      expect(result.unfilledSlots).toEqual([{ date: SUN_0118, roleId: 1 }]);
    });

    it("#8 member on holidays with no availability on that day is doubly ineligible", () => {
      const result = generateSchedule({
        dates: [WED_0121],
        roles: [{ ...CANTANTES, requiredCount: 1 }],
        members: [coniG1],
      });
      expect(result.assignments).toEqual([]);
      expect(result.unfilledSlots).toEqual([{ date: WED_0121, roleId: 1 }]);
    });

    it("#9 member on holidays with wrong time availability is not eligible", () => {
      const result = generateSchedule({
        dates: [SUN_0118],
        roles: [{ ...CANTANTES, requiredCount: 1 }],
        members: [coniG1],
        dayEventTimeWindow: CULTO_NOCHE_TW,
      });
      expect(result.assignments).toEqual([]);
      expect(result.unfilledSlots).toEqual([{ date: SUN_0118, roleId: 1 }]);
    });
  });

  describe("Role-priority assignment without exclusive groups (scenarios 10–17)", () => {
    it("#10 sole member with a role always fills it when eligible", () => {
      const result = generateSchedule({
        dates: JAN_SUNDAYS,
        roles: [{ ...MUSICOS, requiredCount: 1 }],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });
      expect(result.assignments).toHaveLength(4);
      expect(result.assignments.every((a) => a.memberId === 2)).toBe(true);
    });

    it("#11 member with multiple roles and no exclusive group gets assigned to all of them", () => {
      const result = generateSchedule({
        dates: [SUN_0104],
        roles: [MUSICOS, CANTANTES],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
      });
      const daniRoles = result.assignments
        .filter((a) => a.memberId === 2)
        .map((a) => a.roleId)
        .sort();
      expect(daniRoles).toEqual([1, 2]);
    });

    it("#12 two eligible members are both assigned when max count is not reached", () => {
      const result = generateSchedule({
        dates: [SUN_0104],
        roles: [CANTANTES],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });
      const memberIds = result.assignments.map((a) => a.memberId).sort();
      expect(memberIds).toEqual([1, 2]);
    });

    it("#13 only eligible member for an event gets all their applicable roles", () => {
      const result = generateSchedule({
        dates: [SUN_0104],
        roles: [
          { ...CANTANTES, requiredCount: 1 },
          { ...MUSICOS, requiredCount: 1 },
        ],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_NOCHE_TW,
        dayRolePriorities: CULTO_NOCHE_PRIO,
      });
      expect(result.assignments).toHaveLength(2);
      expect(result.assignments.every((a) => a.memberId === 2)).toBe(true);
    });

    it("#14 when one member is on holidays the other covers all applicable roles", () => {
      const result = generateSchedule({
        dates: [SUN_0118],
        roles: [
          { ...CANTANTES, requiredCount: 1 },
          { ...MUSICOS, requiredCount: 1 },
        ],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
      });
      expect(result.assignments).toHaveLength(2);
      expect(result.assignments.every((a) => a.memberId === 2)).toBe(true);
    });

    it("#15 priority order does not change the result when no exclusive group constrains", () => {
      const base = {
        dates: [SUN_0104],
        roles: [
          { ...CANTANTES, requiredCount: 1 },
          { ...MUSICOS, requiredCount: 1 },
        ],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      };
      const musicosFirst = generateSchedule({
        ...base,
        dayRolePriorities: CULTO_DIA_PRIO,
      });
      const cantantesFirst = generateSchedule({
        ...base,
        dayRolePriorities: CULTO_NOCHE_PRIO,
      });

      const sortA = (a: ScheduleAssignment[]) =>
        [...a].sort((x, y) => x.roleId - y.roleId || x.memberId - y.memberId);

      expect(sortA(musicosFirst.assignments)).toEqual(
        sortA(cantantesFirst.assignments),
      );
    });

    it("#16 with exclusive groups the higher-priority role wins and blocks the other", () => {
      const musicosFirst = generateSchedule({
        dates: [SUN_0104],
        roles: [CANTANTES_EX, MUSICOS_EX],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
      });
      const cantantesFirst = generateSchedule({
        dates: [SUN_0104],
        roles: [CANTANTES_EX, MUSICOS_EX],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: { Domingo: { 1: 0, 2: 1 } },
      });
      const daniRoleA = musicosFirst.assignments.find(
        (a) => a.memberId === 2,
      )!.roleId;
      const daniRoleB = cantantesFirst.assignments.find(
        (a) => a.memberId === 2,
      )!.roleId;
      expect(daniRoleA).not.toEqual(daniRoleB);
    });

    it("#17 tight max and round-robin determine who gets the single slot", () => {
      const result = generateSchedule({
        dates: JAN_SUNDAYS,
        roles: [{ ...CANTANTES, requiredCount: 1 }],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });
      expect(result.assignments).toEqual([
        { date: SUN_0104, roleId: 1, memberId: 1 },
        { date: SUN_0111, roleId: 1, memberId: 2 },
        { date: SUN_0118, roleId: 1, memberId: 2 },
        { date: SUN_0125, roleId: 1, memberId: 2 },
      ]);
    });
  });

  describe("Exclusive-group assignment (scenarios 18–26)", () => {
    it("#18 exclusive group blocks a member from a second different role on the same date", () => {
      const result = generateSchedule({
        dates: [SUN_0104],
        roles: [
          { ...CANTANTES_EX, requiredCount: 1 },
          { ...MUSICOS_EX, requiredCount: 1 },
        ],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
      });
      expect(result.assignments).toContainEqual({
        date: SUN_0104,
        roleId: 2,
        memberId: 2,
      });
      expect(result.assignments).toContainEqual({
        date: SUN_0104,
        roleId: 1,
        memberId: 1,
      });
    });

    it("#19 exclusive group causes higher-priority role to go unfilled when sole eligible member is blocked across events", () => {
      const roles: RoleDefinition[] = [
        { ...CANTANTES_EX, requiredCount: 1 },
        { ...MUSICOS_EX, requiredCount: 1 },
      ];
      const diaResult = generateSchedule({
        dates: [SUN_0104],
        roles,
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
      });

      const nocheResult = generateSchedule({
        dates: [SUN_0104],
        roles,
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_NOCHE_TW,
        dayRolePriorities: CULTO_NOCHE_PRIO,
        previousAssignments: diaResult.assignments,
      });

      expect(nocheResult.assignments).toEqual([
        { date: SUN_0104, roleId: 2, memberId: 2 },
      ]);
      expect(nocheResult.unfilledSlots).toContainEqual({
        date: SUN_0104,
        roleId: 1,
      });
    });

    it("#20 same role on two events on the same date is not blocked by exclusive group", () => {
      const diaResult = generateSchedule({
        dates: [SUN_0104],
        roles: [{ ...MUSICOS_EX, requiredCount: 1 }],
        members: [daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });
      expect(diaResult.assignments).toHaveLength(1);

      const nocheResult = generateSchedule({
        dates: [SUN_0104],
        roles: [{ ...MUSICOS_EX, requiredCount: 1 }],
        members: [daniG1],
        dayEventTimeWindow: CULTO_NOCHE_TW,
        previousAssignments: diaResult.assignments,
      });
      expect(nocheResult.assignments).toEqual([
        { date: SUN_0104, roleId: 2, memberId: 2 },
      ]);
    });

    it("#21 single-role member is unaffected by exclusive group constraints", () => {
      const result = generateSchedule({
        dates: [SUN_0104],
        roles: [
          { ...CANTANTES_EX, requiredCount: 1 },
          { ...MUSICOS_EX, requiredCount: 1 },
        ],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
      });
      const coniAssignment = result.assignments.find((a) => a.memberId === 1);
      expect(coniAssignment).toBeDefined();
      expect(coniAssignment!.roleId).toBe(1);
    });

    it("#22 processing events in different order changes exclusive-group outcome", () => {
      const roles: RoleDefinition[] = [
        { ...CANTANTES_EX, requiredCount: 1 },
        { ...MUSICOS_EX, requiredCount: 1 },
      ];
      const members = [coniG1, daniG1];

      const diaA = generateSchedule({
        dates: [SUN_0104],
        roles,
        members,
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
      });
      const nocheA = generateSchedule({
        dates: [SUN_0104],
        roles,
        members,
        dayEventTimeWindow: CULTO_NOCHE_TW,
        dayRolePriorities: CULTO_NOCHE_PRIO,
        previousAssignments: diaA.assignments,
      });

      const nocheB = generateSchedule({
        dates: [SUN_0104],
        roles,
        members,
        dayEventTimeWindow: CULTO_NOCHE_TW,
        dayRolePriorities: CULTO_NOCHE_PRIO,
      });
      const diaB = generateSchedule({
        dates: [SUN_0104],
        roles,
        members,
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
        previousAssignments: nocheB.assignments,
      });

      const totalA = diaA.assignments.length + nocheA.assignments.length;
      const totalB = nocheB.assignments.length + diaB.assignments.length;

      expect(totalA).toBe(3);
      expect(totalB).toBe(2);
    });

    it("#23 swapping priority order with exclusive groups changes which role a member gets", () => {
      const musicosFirst = generateSchedule({
        dates: [SUN_0104],
        roles: [CANTANTES_EX, MUSICOS_EX],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
      });
      const cantantesFirst = generateSchedule({
        dates: [SUN_0104],
        roles: [CANTANTES_EX, MUSICOS_EX],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: { Domingo: { 1: 0, 2: 1 } },
      });

      expect(musicosFirst.assignments).toContainEqual({
        date: SUN_0104,
        roleId: 2,
        memberId: 2,
      });
      expect(musicosFirst.assignments).toContainEqual({
        date: SUN_0104,
        roleId: 1,
        memberId: 1,
      });

      expect(cantantesFirst.assignments).toContainEqual({
        date: SUN_0104,
        roleId: 1,
        memberId: 2,
      });
      expect(cantantesFirst.assignments).toContainEqual({
        date: SUN_0104,
        roleId: 1,
        memberId: 1,
      });
      expect(cantantesFirst.unfilledSlots).toContainEqual({
        date: SUN_0104,
        roleId: 2,
      });
    });

    it("#24 role goes unfilled when all members are either blocked or on holidays", () => {
      const result = generateSchedule({
        dates: [SUN_0118],
        roles: [
          { ...CANTANTES_EX, requiredCount: 1 },
          { ...MUSICOS_EX, requiredCount: 1 },
        ],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
      });
      expect(result.assignments).toContainEqual({
        date: SUN_0118,
        roleId: 2,
        memberId: 2,
      });
      expect(result.unfilledSlots).toContainEqual({
        date: SUN_0118,
        roleId: 1,
      });
    });

    it("#25 role not in any exclusive group is assigned independently", () => {
      const result = generateSchedule({
        dates: [SUN_0104],
        roles: [{ ...ADORACION, requiredCount: 1 }],
        members: [coniG2],
        dayEventTimeWindow: REUNION_AM_TW,
      });
      expect(result.assignments).toEqual([
        { date: SUN_0104, roleId: 3, memberId: 1 },
      ]);
    });

    it("#26 exclusive group constraints apply only within a group, not across groups", () => {
      const g1Result = generateSchedule({
        dates: [SUN_0104],
        roles: [{ ...MUSICOS_EX, requiredCount: 1 }],
        members: [daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });
      expect(g1Result.assignments).toHaveLength(1);

      const g2Result = generateSchedule({
        dates: [SUN_0104],
        roles: [{ ...ADORACION, requiredCount: 1 }],
        members: [coniG2],
        dayEventTimeWindow: REUNION_AM_TW,
      });
      expect(g2Result.assignments).toEqual([
        { date: SUN_0104, roleId: 3, memberId: 1 },
      ]);
    });
  });

  describe("Month continuity and round-robin (scenarios 32–40)", () => {
    it("#32 assignment pattern repeats when constraints fully determine outcomes", () => {
      const roles: RoleDefinition[] = [
        { ...CANTANTES_EX, requiredCount: 1 },
        { ...MUSICOS_EX, requiredCount: 1 },
      ];
      const janResult = generateSchedule({
        dates: JAN_SUNDAYS,
        roles,
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
      });

      const coniNoHolidays: MemberInfo = { ...coniG1, holidays: [] };
      const febResult = generateSchedule({
        dates: FEB_SUNDAYS,
        roles,
        members: [coniNoHolidays, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
        previousAssignments: janResult.assignments,
      });

      for (const date of FEB_SUNDAYS) {
        expect(febResult.assignments).toContainEqual({
          date,
          roleId: 2,
          memberId: 2,
        });
        expect(febResult.assignments).toContainEqual({
          date,
          roleId: 1,
          memberId: 1,
        });
      }
    });

    it("#33 round-robin pointer carries over from previous month", () => {
      const cantantesMax1: RoleDefinition = {
        id: 1,
        name: "Cantantes",
        requiredCount: 1,
      };
      const janResult = generateSchedule({
        dates: JAN_SUNDAYS,
        roles: [cantantesMax1],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });

      const coniNoHolidays: MemberInfo = { ...coniG1, holidays: [] };
      const febResult = generateSchedule({
        dates: FEB_SUNDAYS,
        roles: [cantantesMax1],
        members: [coniNoHolidays, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        previousAssignments: janResult.assignments,
      });

      expect(febResult.assignments[0]).toEqual({
        date: SUN_0201,
        roleId: 1,
        memberId: 1,
      });
    });

    it("#34 returning member re-enters rotation at the pointer position", () => {
      const cantantesMax1: RoleDefinition = {
        id: 1,
        name: "Cantantes",
        requiredCount: 1,
      };
      const janResult = generateSchedule({
        dates: JAN_SUNDAYS,
        roles: [cantantesMax1],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });

      const coniNoHolidays: MemberInfo = { ...coniG1, holidays: [] };
      const febResult = generateSchedule({
        dates: [SUN_0201],
        roles: [cantantesMax1],
        members: [coniNoHolidays, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        previousAssignments: janResult.assignments,
      });

      expect(febResult.assignments).toEqual([
        { date: SUN_0201, roleId: 1, memberId: 1 },
      ]);
    });

    it("#35 pointer does not skip past a member on holidays, preserving fairness on return", () => {
      const cantantesMax1: RoleDefinition = {
        id: 1,
        name: "Cantantes",
        requiredCount: 1,
      };
      const janResult = generateSchedule({
        dates: JAN_SUNDAYS,
        roles: [cantantesMax1],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });

      const coniNoHolidays: MemberInfo = { ...coniG1, holidays: [] };
      const febResult = generateSchedule({
        dates: FEB_SUNDAYS,
        roles: [cantantesMax1],
        members: [coniNoHolidays, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        previousAssignments: janResult.assignments,
      });

      expect(febResult.assignments).toEqual([
        { date: SUN_0201, roleId: 1, memberId: 1 },
        { date: SUN_0208, roleId: 1, memberId: 2 },
        { date: SUN_0215, roleId: 1, memberId: 1 },
        { date: SUN_0222, roleId: 1, memberId: 2 },
      ]);
    });

    it("#36 round-robin is irrelevant when exclusive group leaves only one eligible member per role", () => {
      const roles: RoleDefinition[] = [
        { ...CANTANTES_EX, requiredCount: 1 },
        { ...MUSICOS_EX, requiredCount: 1 },
      ];
      const result = generateSchedule({
        dates: FEB_SUNDAYS,
        roles,
        members: [{ ...coniG1, holidays: [] }, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        dayRolePriorities: CULTO_DIA_PRIO,
      });

      for (const date of FEB_SUNDAYS) {
        expect(result.assignments).toContainEqual({
          date,
          roleId: 2,
          memberId: 2,
        });
        expect(result.assignments).toContainEqual({
          date,
          roleId: 1,
          memberId: 1,
        });
      }
    });

    it("#37 round-robin matters with tight max and multiple eligible members", () => {
      const cantantesMax1: RoleDefinition = {
        id: 1,
        name: "Cantantes",
        requiredCount: 1,
      };

      const janResult = generateSchedule({
        dates: JAN_SUNDAYS,
        roles: [cantantesMax1],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });

      const coniNoHolidays: MemberInfo = { ...coniG1, holidays: [] };
      const febResult = generateSchedule({
        dates: FEB_SUNDAYS,
        roles: [cantantesMax1],
        members: [coniNoHolidays, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        previousAssignments: janResult.assignments,
      });

      expect(febResult.assignments[0].memberId).toBe(1);
      expect(febResult.assignments[1].memberId).toBe(2);
    });

    it("#38 new member joining in a new month enters the rotation at the end", () => {
      const cantantesMax1: RoleDefinition = {
        id: 1,
        name: "Cantantes",
        requiredCount: 1,
      };

      const janResult = generateSchedule({
        dates: JAN_SUNDAYS,
        roles: [cantantesMax1],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });

      const coniNoHolidays: MemberInfo = { ...coniG1, holidays: [] };
      const eliG1: MemberInfo = {
        id: 3,
        name: "Eli",
        roleIds: [1],
        availableDays: ["Domingo"],
        holidays: [],
        availabilityBlocksByDay: {
          Domingo: [{ startUtc: "09:00", endUtc: "13:00" }],
        },
      };

      const febResult = generateSchedule({
        dates: FEB_SUNDAYS,
        roles: [cantantesMax1],
        members: [coniNoHolidays, daniG1, eliG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        previousAssignments: janResult.assignments,
      });

      expect(febResult.assignments).toEqual([
        { date: SUN_0201, roleId: 1, memberId: 3 },
        { date: SUN_0208, roleId: 1, memberId: 1 },
        { date: SUN_0215, roleId: 1, memberId: 2 },
        { date: SUN_0222, roleId: 1, memberId: 3 },
      ]);
    });

    it("#39 changed availability between months alters eligibility", () => {
      const daniNarrow: MemberInfo = {
        ...daniG1,
        availabilityBlocksByDay: {
          Domingo: [{ startUtc: "09:00", endUtc: "13:00" }],
          Miércoles: [{ startUtc: "18:00", endUtc: "21:00" }],
        },
      };

      const result = generateSchedule({
        dates: [SUN_0201],
        roles: [{ ...CANTANTES, requiredCount: 1 }],
        members: [{ ...coniG1, holidays: [] }, daniNarrow],
        dayEventTimeWindow: CULTO_NOCHE_TW,
      });

      expect(result.assignments).toEqual([]);
      expect(result.unfilledSlots).toEqual([{ date: SUN_0201, roleId: 1 }]);
    });

    it("#40 accumulated imbalance does not auto-compensate when constraints are unchanged", () => {
      const cantantesMax1: RoleDefinition = {
        id: 1,
        name: "Cantantes",
        requiredCount: 1,
      };

      const janResult = generateSchedule({
        dates: JAN_SUNDAYS,
        roles: [cantantesMax1],
        members: [coniG1, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
      });

      const janDani = janResult.assignments.filter(
        (a) => a.memberId === 2,
      ).length;
      const janConi = janResult.assignments.filter(
        (a) => a.memberId === 1,
      ).length;
      expect(janDani).toBe(3);
      expect(janConi).toBe(1);

      const coniNoHolidays: MemberInfo = { ...coniG1, holidays: [] };
      const febResult = generateSchedule({
        dates: FEB_SUNDAYS,
        roles: [cantantesMax1],
        members: [coniNoHolidays, daniG1],
        dayEventTimeWindow: CULTO_DIA_TW,
        previousAssignments: janResult.assignments,
      });

      const febDani = febResult.assignments.filter(
        (a) => a.memberId === 2,
      ).length;
      const febConi = febResult.assignments.filter(
        (a) => a.memberId === 1,
      ).length;
      expect(febConi).toBe(2);
      expect(febDani).toBe(2);
    });
  });
});
