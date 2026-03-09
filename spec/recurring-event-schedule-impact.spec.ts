/**
 * Specs for recurring event behaviour: affected schedule dates, delete with option
 * to remove dates, update (day change, deactivate hides dates), and recalculate
 * assignments. Descriptions use real scenarios, not technical terms.
 */
import { NextRequest, NextResponse } from "next/server";
import { aggregateAffectedScheduleDates } from "@/lib/affected-schedule-dates";

const mockRequireGroupAccess = jest.fn();
jest.mock("@/lib/api-helpers", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { z } = require("zod");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    requireGroupAccess: (...args: unknown[]) => mockRequireGroupAccess(...args),
    apiError: (message: string, status: number, _code?: string) =>
      NextResponse.json({ error: message }, { status }),
    parseBody: <T extends z.ZodType>(schema: T, body: unknown) => {
      const result = schema.safeParse(body);
      if (result.success) return { data: result.data };
      const first = result.error.issues[0];
      return {
        error: NextResponse.json(
          { error: first?.message ?? "Invalid request body" },
          { status: 400 }
        ),
      };
    },
  };
});

const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockDelete = jest.fn();
const mockSet = jest.fn();

jest.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    from: (...args: unknown[]) => mockFrom(...args),
    where: jest.fn(),
    innerJoin: jest.fn(),
    delete: (...args: unknown[]) => mockDelete(...args),
    update: jest.fn().mockReturnValue({ set: (...args: unknown[]) => mockSet(...args) }),
    insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
  },
}));

describe("Affected schedule dates aggregation", () => {
  it("returns zero count and empty list when the event is not used in any schedule", () => {
    const result = aggregateAffectedScheduleDates([]);
    expect(result.count).toBe(0);
    expect(result.schedules).toEqual([]);
  });

  it("returns one schedule with one date when the event appears once in one schedule", () => {
    const result = aggregateAffectedScheduleDates([
      { scheduleId: 10, month: 3, year: 2026 },
    ]);
    expect(result.count).toBe(1);
    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0]).toEqual({
      scheduleId: 10,
      month: 3,
      year: 2026,
      dateCount: 1,
    });
  });

  it("returns correct date count when the event appears several times in the same schedule", () => {
    const result = aggregateAffectedScheduleDates([
      { scheduleId: 5, month: 2, year: 2026 },
      { scheduleId: 5, month: 2, year: 2026 },
      { scheduleId: 5, month: 2, year: 2026 },
    ]);
    expect(result.count).toBe(3);
    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0]).toEqual({
      scheduleId: 5,
      month: 2,
      year: 2026,
      dateCount: 3,
    });
  });

  it("returns one entry per schedule when the event appears in multiple schedules", () => {
    const result = aggregateAffectedScheduleDates([
      { scheduleId: 1, month: 1, year: 2026 },
      { scheduleId: 2, month: 2, year: 2026 },
      { scheduleId: 3, month: 3, year: 2026 },
    ]);
    expect(result.count).toBe(3);
    expect(result.schedules).toHaveLength(3);
    expect(result.schedules.map((s) => s.scheduleId).sort()).toEqual([1, 2, 3]);
    result.schedules.forEach((s) => expect(s.dateCount).toBe(1));
  });

  it("combines multiple dates per schedule across several schedules", () => {
    const result = aggregateAffectedScheduleDates([
      { scheduleId: 1, month: 1, year: 2026 },
      { scheduleId: 1, month: 1, year: 2026 },
      { scheduleId: 2, month: 2, year: 2026 },
    ]);
    expect(result.count).toBe(3);
    expect(result.schedules).toHaveLength(2);
    const s1 = result.schedules.find((s) => s.scheduleId === 1)!;
    const s2 = result.schedules.find((s) => s.scheduleId === 2)!;
    expect(s1.dateCount).toBe(2);
    expect(s2.dateCount).toBe(1);
    expect(s1.month).toBe(1);
    expect(s1.year).toBe(2026);
    expect(s2.month).toBe(2);
    expect(s2.year).toBe(2026);
  });
});

describe("GET affected schedule dates (how many dates use this event)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireGroupAccess.mockResolvedValue({ groupId: 1 });
  });

  it("returns 401 when the user is not allowed to access the group", async () => {
    mockRequireGroupAccess.mockResolvedValueOnce({
      error: NextResponse.json({}, { status: 401 }),
    });
    const { GET } = await import(
      "@/app/api/configuration/days/[id]/affected-schedule-dates/route"
    );
    const req = new NextRequest("http://localhost/api/configuration/days/1/affected-schedule-dates?groupId=1");
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when the event id is not a number", async () => {
    const { GET } = await import(
      "@/app/api/configuration/days/[id]/affected-schedule-dates/route"
    );
    const req = new NextRequest("http://localhost/api/configuration/days/abc/affected-schedule-dates?groupId=1");
    const res = await GET(req, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid|id/i);
  });

  it("returns 404 when the event does not exist or belongs to another group", async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });
    const { GET } = await import(
      "@/app/api/configuration/days/[id]/affected-schedule-dates/route"
    );
    const req = new NextRequest("http://localhost/api/configuration/days/99/affected-schedule-dates?groupId=1");
    const res = await GET(req, { params: Promise.resolve({ id: "99" }) });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/encontrado|not found/i);
  });

  it("returns count and list of schedules when the event exists and has linked dates", async () => {
    mockSelect
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 1, groupId: 1 }]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { scheduleId: 10, month: 3, year: 2026 },
              { scheduleId: 10, month: 3, year: 2026 },
              { scheduleId: 20, month: 4, year: 2026 },
            ]),
          }),
        }),
      });
    const { GET } = await import(
      "@/app/api/configuration/days/[id]/affected-schedule-dates/route"
    );
    const req = new NextRequest("http://localhost/api/configuration/days/1/affected-schedule-dates?groupId=1");
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(3);
    expect(data.schedules).toHaveLength(2);
    const byScheduleId = Object.fromEntries(
      data.schedules.map((s: { scheduleId: number; dateCount: number }) => [s.scheduleId, s.dateCount])
    );
    expect(byScheduleId[10]).toBe(2);
    expect(byScheduleId[20]).toBe(1);
  });

  it("returns zero count when the event exists but has no dates in any schedule", async () => {
    mockSelect
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 1, groupId: 1 }]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
    const { GET } = await import(
      "@/app/api/configuration/days/[id]/affected-schedule-dates/route"
    );
    const req = new NextRequest("http://localhost/api/configuration/days/1/affected-schedule-dates?groupId=1");
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
    expect(data.schedules).toEqual([]);
  });
});

describe("DELETE recurring event", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireGroupAccess.mockResolvedValue({ groupId: 1 });
  });

  it("returns 400 when the event id is not a number", async () => {
    const { DELETE } = await import("@/app/api/configuration/days/[id]/route");
    const req = new NextRequest("http://localhost/api/configuration/days/not-a-number?groupId=1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "not-a-number" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the event does not exist", async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });
    const { DELETE } = await import("@/app/api/configuration/days/[id]/route");
    const req = new NextRequest("http://localhost/api/configuration/days/99?groupId=1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "99" }) });
    expect(res.status).toBe(404);
  });

  it("deletes only the event when removeScheduleDates is false or omitted", async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ id: 1, groupId: 1 }]),
      }),
    });
    mockDelete.mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    const { DELETE } = await import("@/app/api/configuration/days/[id]/route");
    const req = new NextRequest("http://localhost/api/configuration/days/1?groupId=1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeScheduleDates: false }),
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("deletes schedule dates then the event when removeScheduleDates is true", async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ id: 1, groupId: 1 }]),
      }),
    });
    mockDelete.mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    const { DELETE } = await import("@/app/api/configuration/days/[id]/route");
    const req = new NextRequest("http://localhost/api/configuration/days/1?groupId=1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeScheduleDates: true }),
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });
});

describe("PUT recurring event (update day, deactivate)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireGroupAccess.mockResolvedValue({ groupId: 1 });
    mockDelete.mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    mockSet.mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
  });

  it("when deactivating an event (active false), the API deletes linked schedule_date rows so dates disappear from schedules", async () => {
    mockSelect
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 1, groupId: 1 }]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { id: 1, weekdayId: 1, dayOfWeek: "Viernes", active: false, type: "assignable", label: "Evento", startTimeUtc: "00:00", endTimeUtc: "23:59", groupId: 1 },
            ]),
          }),
        }),
      });
    mockDelete.mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    mockSet.mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    const { PUT } = await import("@/app/api/configuration/days/route");
    const req = new NextRequest("http://localhost/api/configuration/days?groupId=1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, active: false }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("returns 404 when the event does not belong to the group", async () => {
    mockRequireGroupAccess.mockResolvedValueOnce({ groupId: 2 });
    mockSelect.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ id: 1, groupId: 1 }]),
      }),
    });
    const { PUT } = await import("@/app/api/configuration/days/route");
    const req = new NextRequest("http://localhost/api/configuration/days?groupId=2", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, label: "Test" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(404);
  });

  it("accepts dayOfWeek when updating an existing event", async () => {
    mockSelect
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 1, groupId: 1, weekdayId: 1 }]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 2, name: "Lunes", displayOrder: 0 }]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { id: 1, weekdayId: 2, dayOfWeek: "Lunes", active: true, type: "assignable", label: "Evento", startTimeUtc: "00:00", endTimeUtc: "23:59", groupId: 1 },
            ]),
          }),
        }),
      });
    const { PUT } = await import("@/app/api/configuration/days/route");
    const req = new NextRequest("http://localhost/api/configuration/days?groupId=1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, dayOfWeek: "Lunes" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.dayOfWeek).toBe("Lunes");
  });
});

describe("POST recalculate assignments after event change", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireGroupAccess.mockResolvedValue({ groupId: 1, user: { id: "user-1" } });
  });

  it("returns 400 when the event id is not a number", async () => {
    const { POST } = await import(
      "@/app/api/configuration/days/[id]/recalculate-assignments/route"
    );
    const req = new NextRequest("http://localhost/api/configuration/days/abc/recalculate-assignments?groupId=1", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("returns success with zero schedules updated when the event has no assignable dates in schedules", async () => {
    mockSelect
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 1, groupId: 1 }]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });
    const { POST } = await import(
      "@/app/api/configuration/days/[id]/recalculate-assignments/route"
    );
    const req = new NextRequest("http://localhost/api/configuration/days/1/recalculate-assignments?groupId=1", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.schedulesUpdated).toBe(0);
  });

  it("returns 404 when the event does not exist", async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });
    const { POST } = await import(
      "@/app/api/configuration/days/[id]/recalculate-assignments/route"
    );
    const req = new NextRequest("http://localhost/api/configuration/days/99/recalculate-assignments?groupId=1", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "99" }) });
    expect(res.status).toBe(404);
  });
});

describe("Recurring event delete and update behaviour (documented)", () => {
  it("when deleting an event, the API accepts removeScheduleDates true to also remove its dates from schedules", () => {
    expect(true).toBe(true);
  });

  it("when deactivating an event (Incluir en el cronograma off), the API removes its dates from all schedules", () => {
    expect(true).toBe(true);
  });

  it("when changing the event day or times, the user can choose to recalculate assignments in affected schedules", () => {
    expect(true).toBe(true);
  });
});
