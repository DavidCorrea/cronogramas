import {
  createBootstrapToken,
  validateBootstrapToken,
} from "@/lib/admin-bootstrap-token";

describe("admin bootstrap token", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates a string token", () => {
    const token = createBootstrapToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("validates a freshly created token", () => {
    const token = createBootstrapToken();
    expect(validateBootstrapToken(token)).toBe(true);
  });

  it("rejects an unknown token", () => {
    expect(validateBootstrapToken("nonexistent-token")).toBe(false);
  });

  it("rejects a token after 1 hour expiry", () => {
    const token = createBootstrapToken();
    expect(validateBootstrapToken(token)).toBe(true);

    jest.advanceTimersByTime(60 * 60 * 1000 + 1);
    expect(validateBootstrapToken(token)).toBe(false);
  });

  it("keeps a token valid just before the 1-hour mark", () => {
    const token = createBootstrapToken();
    jest.advanceTimersByTime(60 * 60 * 1000 - 1000);
    expect(validateBootstrapToken(token)).toBe(true);
  });

  it("creates unique tokens on each call", () => {
    const a = createBootstrapToken();
    const b = createBootstrapToken();
    expect(a).not.toBe(b);
  });
});
