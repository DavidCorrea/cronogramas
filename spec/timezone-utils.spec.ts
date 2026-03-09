import {
  toTimeInputValue,
  utcTimeToLocalDisplay,
  localTimeToUtc,
  formatDateLong,
  formatDateShort,
  formatDateWeekdayDay,
  formatDayMonth,
  formatDateRange,
  formatDateWithYear,
  formatDateRangeWithYear,
  getWeekdayName,
  getDayOfWeek,
  formatDateTime,
} from "@/lib/timezone-utils";

describe("toTimeInputValue", () => {
  it("normalises single-digit hours to HH:MM", () => {
    expect(toTimeInputValue("9:05")).toBe("09:05");
  });

  it("passes through already-padded values", () => {
    expect(toTimeInputValue("14:30")).toBe("14:30");
  });

  it("clamps out-of-range values", () => {
    expect(toTimeInputValue("25:70")).toBe("23:59");
  });

  it("returns 00:00 for invalid input", () => {
    expect(toTimeInputValue("abc")).toBe("00:00");
  });
});

describe("utcTimeToLocalDisplay / localTimeToUtc round-trip", () => {
  it("are inverses of each other", () => {
    const times = ["00:00", "09:30", "14:00", "23:59"];
    for (const t of times) {
      expect(localTimeToUtc(utcTimeToLocalDisplay(t))).toBe(t);
    }
  });

  it("both return HH:MM format", () => {
    expect(utcTimeToLocalDisplay("09:30")).toMatch(/^\d{2}:\d{2}$/);
    expect(localTimeToUtc("14:00")).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("formatDateLong", () => {
  it("formats a date with weekday, month, and day in Spanish", () => {
    const result = formatDateLong("2026-03-15");
    expect(result).toMatch(/domingo/i);
    expect(result).toMatch(/marzo/i);
    expect(result).toMatch(/15/);
  });
});

describe("formatDateShort", () => {
  it("formats a date with abbreviated weekday and month", () => {
    const result = formatDateShort("2026-03-15");
    expect(result).toMatch(/dom/i);
    expect(result).toMatch(/15/);
  });
});

describe("formatDateWeekdayDay", () => {
  it("formats as 'Weekday, day' capitalised", () => {
    const result = formatDateWeekdayDay("2026-03-15");
    expect(result).toMatch(/^Domingo, 15$/);
  });
});

describe("formatDayMonth", () => {
  it("formats as 'd month-abbrev'", () => {
    const result = formatDayMonth("2026-03-03");
    expect(result).toMatch(/3/);
    expect(result).toMatch(/mar/i);
  });
});

describe("formatDateRange", () => {
  it("joins two dates with an en-dash", () => {
    const result = formatDateRange("2026-03-01", "2026-03-31");
    expect(result).toContain("–");
    expect(result).toMatch(/1/);
    expect(result).toMatch(/31/);
  });
});

describe("formatDateWithYear", () => {
  it("includes the year in the output", () => {
    const result = formatDateWithYear("2026-06-15");
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/15/);
  });
});

describe("formatDateRangeWithYear", () => {
  it("shows a single date when start and end are the same", () => {
    const result = formatDateRangeWithYear("2026-03-15", "2026-03-15");
    expect(result).not.toContain("—");
    expect(result).toMatch(/2026/);
  });

  it("shows a range with em-dash when dates differ", () => {
    const result = formatDateRangeWithYear("2026-03-01", "2026-03-31");
    expect(result).toContain("—");
  });
});

describe("getWeekdayName", () => {
  it("returns the lowercase Spanish weekday", () => {
    expect(getWeekdayName("2026-03-09")).toBe("lunes");
  });
});

describe("getDayOfWeek", () => {
  it("returns the capitalised Spanish weekday", () => {
    expect(getDayOfWeek("2026-03-09")).toBe("Lunes");
    expect(getDayOfWeek("2026-03-15")).toBe("Domingo");
  });
});

describe("formatDateTime", () => {
  it("formats an ISO datetime string with weekday, date, and time in Spanish", () => {
    const result = formatDateTime("2026-03-15T14:30:00Z");
    expect(result).toMatch(/dom/i);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/30/);
    expect(result).toMatch(/2026/);
  });
});
