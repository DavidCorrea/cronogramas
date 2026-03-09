import { DAY_ORDER, dayIndex } from "@/lib/constants";

describe("DAY_ORDER", () => {
  it("has 7 days starting with Lunes and ending with Domingo", () => {
    expect(DAY_ORDER).toHaveLength(7);
    expect(DAY_ORDER[0]).toBe("Lunes");
    expect(DAY_ORDER[6]).toBe("Domingo");
  });

  it("contains all Spanish weekday names in order", () => {
    expect([...DAY_ORDER]).toEqual([
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ]);
  });
});

describe("dayIndex", () => {
  it("returns correct index for each Spanish day", () => {
    expect(dayIndex("Lunes")).toBe(0);
    expect(dayIndex("Martes")).toBe(1);
    expect(dayIndex("Miércoles")).toBe(2);
    expect(dayIndex("Jueves")).toBe(3);
    expect(dayIndex("Viernes")).toBe(4);
    expect(dayIndex("Sábado")).toBe(5);
    expect(dayIndex("Domingo")).toBe(6);
  });

  it("returns end-of-list index for unknown day names", () => {
    expect(dayIndex("Monday")).toBe(7);
    expect(dayIndex("")).toBe(7);
    expect(dayIndex("lunes")).toBe(7);
  });
});
