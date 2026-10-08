import { describe, expect, it } from "vitest";
import { isInDateRange, parseDateRange } from "./date-range";
import type { DateDirection } from "./date-range";

const NOW = new Date("2026-03-31T12:00:00.000Z");

const parse = (raw: string, direction: DateDirection = "past") =>
  parseDateRange("--updated", raw, { now: NOW, direction });

const iso = (raw: string, direction?: DateDirection) => {
  const { from, to } = parse(raw, direction);
  return { from: from?.toISOString(), to: to?.toISOString() };
};

describe("parseDateRange", () => {
  describe("a bare duration", () => {
    it.each([
      ["30m", "2026-03-31T11:30:00.000Z"],
      ["12h", "2026-03-31T00:00:00.000Z"],
      ["7d", "2026-03-24T12:00:00.000Z"],
      ["2w", "2026-03-17T12:00:00.000Z"],
      ["1y", "2025-03-31T12:00:00.000Z"],
    ])("should read %s as within the last N, open-ended", (raw, from) => {
      expect(iso(raw)).toEqual({ from, to: undefined });
    });

    // One month back from 31 March is February, not early March.
    it("should clamp a month shift to the end of a shorter month", () => {
      expect(iso("1mo").from).toBe("2026-02-28T12:00:00.000Z");
    });

    it("should read a duration forward, bounded by now, when the direction is future", () => {
      expect(iso("7d", "future")).toEqual({
        from: "2026-03-31T12:00:00.000Z",
        to: "2026-04-07T12:00:00.000Z",
      });
    });
  });

  describe("a bare calendar date", () => {
    it.each([
      ["2024", "2024-01-01T00:00:00.000Z", "2024-12-31T23:59:59.999Z"],
      ["2024-02", "2024-02-01T00:00:00.000Z", "2024-02-29T23:59:59.999Z"],
      ["2024-06-15", "2024-06-15T00:00:00.000Z", "2024-06-15T23:59:59.999Z"],
    ])("should read %s as that whole period", (raw, from, to) => {
      expect(iso(raw)).toEqual({ from, to });
    });

    it.each(["2024-02-30", "2024-13", "2024-00-10"])(
      "should reject the impossible date %s",
      (raw) => {
        expect(() => parse(raw)).toThrow(/--updated expects/);
      },
    );
  });

  describe("a datetime", () => {
    it("should read a datetime without an offset as UTC, to the minute", () => {
      expect(iso("2024-06-15T09:30")).toEqual({
        from: "2024-06-15T09:30:00.000Z",
        to: "2024-06-15T09:30:59.999Z",
      });
    });

    it("should apply an explicit offset", () => {
      expect(iso("2024-06-15T09:30:00+02:00")).toEqual({
        from: "2024-06-15T07:30:00.000Z",
        to: "2024-06-15T07:30:00.999Z",
      });
    });

    it("should accept a Z suffix and milliseconds", () => {
      expect(iso("2024-06-15T09:30:00.250Z").from).toBe("2024-06-15T09:30:00.250Z");
    });

    it("should reject an out-of-range time", () => {
      expect(() => parse("2024-06-15T24:00")).toThrow(/--updated expects/);
    });
  });

  describe("a range", () => {
    it("should take the start of the lower bound and the end of the upper one", () => {
      expect(iso("2024-01..2024-03")).toEqual({
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-03-31T23:59:59.999Z",
      });
    });

    it("should leave an omitted side open", () => {
      expect(iso("2024-06-01..")).toEqual({ from: "2024-06-01T00:00:00.000Z", to: undefined });
      expect(iso("..2024-06-30")).toEqual({ from: undefined, to: "2024-06-30T23:59:59.999Z" });
    });

    it("should read durations on both sides relative to now", () => {
      expect(iso("30d..7d")).toEqual({
        from: "2026-03-01T12:00:00.000Z",
        to: "2026-03-24T12:00:00.000Z",
      });
    });

    it("should read 'now' as an instant", () => {
      expect(iso("now..2w", "future")).toEqual({
        from: "2026-03-31T12:00:00.000Z",
        to: "2026-04-14T12:00:00.000Z",
      });
    });

    it("should mix durations and dates", () => {
      expect(iso("2026-01..7d").from).toBe("2026-01-01T00:00:00.000Z");
    });

    // An inverted range matches nothing, which would read as a genuine answer.
    it("should reject a range that starts after it ends", () => {
      expect(() => parse("2024-06..2024-01")).toThrow(/starts after it ends/);
      expect(() => parse("7d..30d")).toThrow(/starts after it ends/);
    });
  });

  it.each(["", " ", "..", "a..b..c", "last week", "7", "7D", "1M", "2024/06/01", "now"])(
    "should reject %j as a usage error naming the flag",
    (raw) => {
      expect(() => parse(raw)).toThrow(/--updated expects/);
    },
  );
});

describe("isInDateRange", () => {
  const range = parse("2024-06");

  it("should include both bounds", () => {
    expect(isInDateRange("2024-06-01T00:00:00.000Z", range)).toBe(true);
    expect(isInDateRange("2024-06-30T23:59:59.999Z", range)).toBe(true);
  });

  it("should exclude a date outside the range", () => {
    expect(isInDateRange("2024-05-31T23:59:59.999Z", range)).toBe(false);
    expect(isInDateRange("2024-07-01T00:00:00.000Z", range)).toBe(false);
  });

  it("should compare instants, whatever the offset the value is written in", () => {
    expect(isInDateRange("2024-07-01T01:00:00+02:00", range)).toBe(true);
  });

  // A draft has no `published_at`, and asking when it was published must not match it.
  it.each([null, undefined, "", "not a date"])(
    "should never match a missing date (%j)",
    (value) => {
      expect(isInDateRange(value, range)).toBe(false);
    },
  );

  it("should match anything dated with no bounds on an open side", () => {
    expect(isInDateRange("1999-01-01T00:00:00.000Z", parse("..2024-06"))).toBe(true);
  });
});
