import { getRawArray } from "@/lib/intl-utils";

function mockTranslations(data: Record<string, unknown>) {
  const t = (() => "") as unknown as { raw: (key: string) => unknown };
  t.raw = (key: string) => data[key];
  return t as Parameters<typeof getRawArray>[0];
}

describe("getRawArray", () => {
  it("returns the array when the message value is an array", () => {
    const t = mockTranslations({ months: ["Ene", "Feb", "Mar"] });
    expect(getRawArray(t, "months")).toEqual(["Ene", "Feb", "Mar"]);
  });

  it("wraps a string value in an array", () => {
    const t = mockTranslations({ title: "Hola" });
    expect(getRawArray(t, "title")).toEqual(["Hola"]);
  });

  it("returns empty array for undefined key", () => {
    const t = mockTranslations({});
    expect(getRawArray(t, "missing")).toEqual([]);
  });

  it("returns empty array when value is null", () => {
    const t = mockTranslations({ empty: null });
    expect(getRawArray(t, "empty")).toEqual([]);
  });

  it("returns empty array when value is a number", () => {
    const t = mockTranslations({ count: 42 });
    expect(getRawArray(t, "count")).toEqual([]);
  });
});
