import { findHolidayConflicts } from "@/lib/holiday-conflicts";

describe("when detecting assignments that conflict with holidays", () => {
  const groupMembers = [
    { id: 1, name: "Ana", userId: "user-a" },
    { id: 2, name: "Carlos", userId: null },
    { id: 3, name: "Marta", userId: "user-b" },
  ];

  it("flags a member assigned on a date within their holiday range", () => {
    const entries = [{ date: "2026-03-15", memberId: 1 }];
    const allHolidays = [
      { memberId: 1, userId: null, startDate: "2026-03-10", endDate: "2026-03-20" },
    ];
    const result = findHolidayConflicts(entries, groupMembers, allHolidays);
    expect(result).toEqual([
      { date: "2026-03-15", memberId: 1, memberName: "Ana" },
    ]);
  });

  it("does not flag a member who is not on holiday", () => {
    const entries = [{ date: "2026-03-25", memberId: 1 }];
    const allHolidays = [
      { memberId: 1, userId: null, startDate: "2026-03-10", endDate: "2026-03-20" },
    ];
    expect(findHolidayConflicts(entries, groupMembers, allHolidays)).toEqual([]);
  });

  it("user-level holidays apply to linked members", () => {
    const entries = [{ date: "2026-04-05", memberId: 3 }];
    const allHolidays = [
      { memberId: null, userId: "user-b", startDate: "2026-04-01", endDate: "2026-04-10" },
    ];
    const result = findHolidayConflicts(entries, groupMembers, allHolidays);
    expect(result).toEqual([
      { date: "2026-04-05", memberId: 3, memberName: "Marta" },
    ]);
  });

  it("user-level holidays do not affect unlinked members", () => {
    const entries = [{ date: "2026-04-05", memberId: 2 }];
    const allHolidays = [
      { memberId: null, userId: "user-b", startDate: "2026-04-01", endDate: "2026-04-10" },
    ];
    expect(findHolidayConflicts(entries, groupMembers, allHolidays)).toEqual([]);
  });

  it("returns empty for empty entries", () => {
    const allHolidays = [
      { memberId: 1, userId: null, startDate: "2026-03-01", endDate: "2026-03-31" },
    ];
    expect(findHolidayConflicts([], groupMembers, allHolidays)).toEqual([]);
  });

  it("handles multiple members with some on holiday and some not", () => {
    const entries = [
      { date: "2026-03-15", memberId: 1 },
      { date: "2026-03-15", memberId: 2 },
      { date: "2026-03-15", memberId: 3 },
    ];
    const allHolidays = [
      { memberId: 1, userId: null, startDate: "2026-03-10", endDate: "2026-03-20" },
      { memberId: null, userId: "user-b", startDate: "2026-03-14", endDate: "2026-03-16" },
    ];
    const result = findHolidayConflicts(entries, groupMembers, allHolidays);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.memberId)).toEqual(expect.arrayContaining([1, 3]));
    expect(result.map((c) => c.memberId)).not.toContain(2);
  });

  it("uses 'Desconocido' for members not in the group members list", () => {
    const entries = [{ date: "2026-03-15", memberId: 99 }];
    const allHolidays = [
      { memberId: 99, userId: null, startDate: "2026-03-01", endDate: "2026-03-31" },
    ];
    const result = findHolidayConflicts(entries, groupMembers, allHolidays);
    expect(result[0].memberName).toBe("Desconocido");
  });

  it("flags on exact boundary dates (start and end inclusive)", () => {
    const entries = [
      { date: "2026-03-10", memberId: 1 },
      { date: "2026-03-20", memberId: 1 },
    ];
    const allHolidays = [
      { memberId: 1, userId: null, startDate: "2026-03-10", endDate: "2026-03-20" },
    ];
    const result = findHolidayConflicts(entries, groupMembers, allHolidays);
    expect(result).toHaveLength(2);
  });
});
