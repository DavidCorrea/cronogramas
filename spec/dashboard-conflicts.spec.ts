import {
  rangesOverlap,
  buildConflicts,
  getOverlapSpan,
  getConflictTimespans,
  type AssignmentWithTime,
} from "@/lib/dashboard-conflicts";

describe("Dashboard conflict detection (time-aware)", () => {
  describe("when checking if two time ranges overlap", () => {
    it("does not overlap when one block ends exactly when the other starts", () => {
      expect(rangesOverlap("09:00", "12:00", "12:00", "15:00")).toBe(false);
      expect(rangesOverlap("12:00", "15:00", "09:00", "12:00")).toBe(false);
    });

    it("does not overlap when blocks are clearly separate", () => {
      expect(rangesOverlap("09:00", "12:00", "18:00", "21:00")).toBe(false);
      expect(rangesOverlap("18:00", "21:00", "09:00", "12:00")).toBe(false);
    });

    it("overlaps when one block is fully inside the other", () => {
      expect(rangesOverlap("10:00", "11:00", "09:00", "12:00")).toBe(true);
      expect(rangesOverlap("09:00", "12:00", "10:00", "11:00")).toBe(true);
    });

    it("overlaps when blocks partially overlap", () => {
      expect(rangesOverlap("09:00", "12:00", "10:00", "13:00")).toBe(true);
      expect(rangesOverlap("10:00", "13:00", "09:00", "12:00")).toBe(true);
    });

    it("overlaps for all-day range with any other range on the same day", () => {
      expect(rangesOverlap("00:00", "23:59", "09:00", "12:00")).toBe(true);
      expect(rangesOverlap("14:00", "18:00", "00:00", "23:59")).toBe(true);
    });
  });

  describe("when building cross-group conflicts from assignments", () => {
    function assignment(
      date: string,
      groupId: number,
      groupName: string,
      start: string,
      end: string,
    ): AssignmentWithTime {
      return {
        date,
        groupId,
        groupName,
        startTimeUtc: start,
        endTimeUtc: end,
      };
    }

    it("does not report a conflict when two assignments on the same date are in different groups and their times do not overlap", () => {
      const assignments: AssignmentWithTime[] = [
        assignment("2026-03-15", 1, "Band A", "09:00", "12:00"),
        assignment("2026-03-15", 2, "Band B", "18:00", "21:00"),
      ];
      expect(buildConflicts(assignments)).toEqual([]);
    });

    it("reports a conflict when two assignments on the same date are in different groups and their times overlap", () => {
      const assignments: AssignmentWithTime[] = [
        assignment("2026-03-15", 1, "Band A", "09:00", "12:00"),
        assignment("2026-03-15", 2, "Band B", "10:00", "11:00"),
      ];
      expect(buildConflicts(assignments)).toEqual([
        { date: "2026-03-15", groups: ["Band A", "Band B"] },
      ]);
    });

    it("does not report a conflict when two assignments on the same date are in the same group", () => {
      const assignments: AssignmentWithTime[] = [
        assignment("2026-03-15", 1, "Band A", "09:00", "12:00"),
        assignment("2026-03-15", 1, "Band A", "14:00", "17:00"),
      ];
      expect(buildConflicts(assignments)).toEqual([]);
    });

    it("reports no conflicts when assignments are on different dates", () => {
      const assignments: AssignmentWithTime[] = [
        assignment("2026-03-15", 1, "Band A", "09:00", "12:00"),
        assignment("2026-03-16", 2, "Band B", "09:00", "12:00"),
      ];
      expect(buildConflicts(assignments)).toEqual([]);
    });

    it("includes all three group names when three groups have overlapping assignments on the same date", () => {
      const assignments: AssignmentWithTime[] = [
        assignment("2026-03-15", 1, "Band A", "09:00", "11:00"),
        assignment("2026-03-15", 2, "Band B", "10:00", "12:00"),
        assignment("2026-03-15", 3, "Band C", "11:00", "13:00"),
      ];
      const result = buildConflicts(assignments);
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe("2026-03-15");
      expect(result[0].groups).toEqual(expect.arrayContaining(["Band A", "Band B", "Band C"]));
      expect(result[0].groups).toHaveLength(3);
    });

    it("yields empty conflicts when assignments list is empty", () => {
      expect(buildConflicts([])).toEqual([]);
    });
  });

  describe("Cross-group conflicts (scenarios 27–31)", () => {
    function a(
      date: string,
      groupId: number,
      groupName: string,
      start: string,
      end: string,
    ): AssignmentWithTime {
      return {
        date,
        groupId,
        groupName,
        startTimeUtc: start,
        endTimeUtc: end,
      };
    }

    it("#27 conflict when a member is eligible in two groups with overlapping event times", () => {
      const assignments = [
        a("2026-01-04", 1, "CCMDV", "09:00", "13:00"),
        a("2026-01-04", 2, "Iglesia Central", "10:00", "12:00"),
      ];
      const result = buildConflicts(assignments);
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe("2026-01-04");
      expect(result[0].groups).toEqual(["CCMDV", "Iglesia Central"]);
    });

    it("#28 no conflict when a member is eligible in two groups with non-overlapping times", () => {
      const assignments = [
        a("2026-01-04", 1, "CCMDV", "09:00", "13:00"),
        a("2026-01-04", 2, "Iglesia Central", "15:00", "17:00"),
      ];
      expect(buildConflicts(assignments)).toEqual([]);
    });

    it("#29 no conflict when a member is eligible in only one group on that date", () => {
      const assignments = [
        a("2026-01-07", 2, "Iglesia Central", "18:00", "20:00"),
      ];
      expect(buildConflicts(assignments)).toEqual([]);
    });

    it("#30 no conflict when a member is not eligible in either group due to holidays", () => {
      expect(buildConflicts([])).toEqual([]);
    });

    it("#31 no conflict when a member belongs to only one group", () => {
      const assignments = [
        a("2026-01-04", 1, "CCMDV", "09:00", "13:00"),
        a("2026-01-04", 1, "CCMDV", "19:00", "21:00"),
      ];
      expect(buildConflicts(assignments)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getOverlapSpan
  // -------------------------------------------------------------------------

  describe("when calculating the overlap span between two ranges", () => {
    it("returns the intersection of two partially overlapping ranges", () => {
      expect(getOverlapSpan("09:00", "12:00", "10:00", "14:00")).toEqual({
        start: "10:00",
        end: "12:00",
      });
    });

    it("returns the inner range when one is fully contained", () => {
      expect(getOverlapSpan("08:00", "18:00", "10:00", "14:00")).toEqual({
        start: "10:00",
        end: "14:00",
      });
    });

    it("returns null when ranges do not overlap", () => {
      expect(getOverlapSpan("09:00", "12:00", "14:00", "17:00")).toBeNull();
    });

    it("returns null when ranges touch at the boundary (exclusive end)", () => {
      expect(getOverlapSpan("09:00", "12:00", "12:00", "15:00")).toBeNull();
    });

    it("handles identical ranges", () => {
      expect(getOverlapSpan("10:00", "14:00", "10:00", "14:00")).toEqual({
        start: "10:00",
        end: "14:00",
      });
    });
  });

  // -------------------------------------------------------------------------
  // getConflictTimespans
  // -------------------------------------------------------------------------

  describe("when detecting conflict timespans across groups", () => {
    function assignment(
      groupId: number,
      groupName: string,
      start: string,
      end: string,
    ): AssignmentWithTime {
      return { date: "2026-03-15", groupId, groupName, startTimeUtc: start, endTimeUtc: end };
    }

    it("finds cross-group overlaps with correct timespans", () => {
      const result = getConflictTimespans([
        assignment(1, "Band A", "09:00", "12:00"),
        assignment(2, "Band B", "10:00", "14:00"),
      ]);
      expect(result).toEqual([
        { groupNames: ["Band A", "Band B"], startUtc: "10:00", endUtc: "12:00" },
      ]);
    });

    it("skips same-group pairs", () => {
      const result = getConflictTimespans([
        assignment(1, "Band A", "09:00", "12:00"),
        assignment(1, "Band A", "10:00", "14:00"),
      ]);
      expect(result).toEqual([]);
    });

    it("returns empty when there are no overlaps", () => {
      const result = getConflictTimespans([
        assignment(1, "Band A", "09:00", "12:00"),
        assignment(2, "Band B", "14:00", "17:00"),
      ]);
      expect(result).toEqual([]);
    });

    it("returns multiple timespans for three-way overlapping groups", () => {
      const result = getConflictTimespans([
        assignment(1, "Band A", "09:00", "13:00"),
        assignment(2, "Band B", "10:00", "14:00"),
        assignment(3, "Band C", "12:00", "16:00"),
      ]);
      expect(result).toHaveLength(3);
    });

    it("sorts group names alphabetically in each timespan", () => {
      const result = getConflictTimespans([
        assignment(2, "Zebra", "09:00", "12:00"),
        assignment(1, "Alpha", "10:00", "14:00"),
      ]);
      expect(result[0].groupNames).toEqual(["Alpha", "Zebra"]);
    });
  });
});
