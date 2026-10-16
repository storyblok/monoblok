import { describe, expect, it } from "vitest";

import { formatValue, quoteString } from "./format";

describe("formatValue", () => {
  it("should quote object keys that are not valid identifiers", () => {
    expect(formatValue({ "data-x": 1, "a b": 2, plain: 3 }, 0)).toBe(
      "{\n  'a b': 2,\n  'data-x': 1,\n  plain: 3,\n}",
    );
  });

  it("should format null and undefined as strings", () => {
    expect(formatValue(null, 0)).toBe("null");
    expect(formatValue(undefined, 0)).toBe("undefined");
  });

  it("should format strings with single quotes", () => {
    expect(formatValue("hello", 0)).toBe("'hello'");
  });

  it("should escape single quotes inside strings", () => {
    expect(formatValue("it's", 0)).toBe("'it\\'s'");
  });

  it("should escape backslashes so regex values are not silently dropped", () => {
    // Emitted as '\\d+' — a single-quoted literal that parses back to the exact
    // input `\d+`. The old serializer emitted '\d+', which parses to `d+`.
    expect(formatValue(String.raw`\d+`, 0)).toBe(String.raw`'\\d+'`);
    expect(formatValue(String.raw`^\s*\b\w+(?:\s+\w+){0,3}\s*$`, 0)).toBe(
      String.raw`'^\\s*\\b\\w+(?:\\s+\\w+){0,3}\\s*$'`,
    );
  });

  it("should escape newlines instead of emitting raw line breaks", () => {
    expect(formatValue("a\nb", 0)).toBe(String.raw`'a\nb'`);
    expect(formatValue("a\nb", 0)).not.toContain("\n");
  });

  it("should escape a trailing backslash so it does not consume the closing quote", () => {
    expect(formatValue("path\\", 0)).toBe(String.raw`'path\\'`);
  });

  it("should leave double quotes untouched inside single-quoted literals", () => {
    expect(formatValue('he said "hi"', 0)).toBe(String.raw`'he said "hi"'`);
  });

  it("should format numbers and booleans", () => {
    expect(formatValue(42, 0)).toBe("42");
    expect(formatValue(true, 0)).toBe("true");
    expect(formatValue(false, 0)).toBe("false");
  });

  it("should format empty arrays", () => {
    expect(formatValue([], 0)).toBe("[]");
  });

  it("should format arrays with items", () => {
    const result = formatValue(["a", "b"], 0);
    expect(result).toBe("[\n  'a',\n  'b',\n]");
  });

  it("should format empty objects", () => {
    expect(formatValue({}, 0)).toBe("{}");
  });

  it("should format objects with sorted keys", () => {
    const result = formatValue({ z: 1, a: 2 }, 0);
    expect(result).toBe("{\n  a: 2,\n  z: 1,\n}");
  });

  it("should filter out null and undefined object values", () => {
    const result = formatValue({ a: 1, b: null, c: undefined, d: 2 }, 0);
    expect(result).toBe("{\n  a: 1,\n  d: 2,\n}");
  });

  it("should handle nested objects with correct indentation", () => {
    const result = formatValue({ outer: { inner: "value" } }, 0);
    expect(result).toContain("outer: {\n    inner:");
  });
});

describe("quoteString", () => {
  it("should wrap plain strings in single quotes", () => {
    expect(quoteString("hello")).toBe(String.raw`'hello'`);
  });

  it("should escape single quotes", () => {
    expect(quoteString("it's")).toBe("'it\\'s'");
  });

  it("should escape backslashes", () => {
    expect(quoteString(String.raw`\d+`)).toBe(String.raw`'\\d+'`);
  });

  it("should escape newlines", () => {
    expect(quoteString("a\nb")).toBe(String.raw`'a\nb'`);
  });

  it("should escape a trailing backslash", () => {
    expect(quoteString("path\\")).toBe(String.raw`'path\\'`);
  });

  it("should escape a backslash followed by a quote", () => {
    expect(quoteString(String.raw`a\"b`)).toBe(String.raw`'a\\"b'`);
  });
});
