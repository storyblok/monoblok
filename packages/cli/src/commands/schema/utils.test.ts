import { join } from "pathe";
import { describe, expect, it } from "vitest";

import { applyDefaults, displayPath, fileTimestamp } from "./utils";

describe("fileTimestamp", () => {
  it("should convert an ISO timestamp to compact YYYYMMDDHHmmss form", () => {
    expect(fileTimestamp("2024-01-15T10:30:00")).toBe("20240115103000");
  });

  it("should drop milliseconds and timezone suffix", () => {
    expect(fileTimestamp("2024-01-15T10:30:00.123Z")).toBe("20240115103000");
  });

  it("should produce a filesystem-safe string", () => {
    const result = fileTimestamp("2024-01-15T10:30:00.000Z");
    expect(result).toMatch(/^\d{14}$/);
  });
});

describe("displayPath", () => {
  it("should return a path relative to CWD by default", () => {
    const filePath = join(process.cwd(), ".storyblok/migrations/12345/hero.20260430114254.js");
    expect(displayPath(filePath)).toBe(".storyblok/migrations/12345/hero.20260430114254.js");
  });

  it("should return a path relative to CWD when the user path is relative", () => {
    const filePath = join(process.cwd(), "custom/migrations/12345/hero.js");
    expect(displayPath(filePath, "custom")).toBe("custom/migrations/12345/hero.js");
  });

  it("should keep the absolute path when the user passed an absolute path", () => {
    const filePath = join(process.cwd(), "storage/migrations/12345/hero.js");
    expect(displayPath(filePath, process.cwd())).toBe(filePath);
  });

  it("should keep the absolute path when the file lies outside CWD", () => {
    const filePath = join(process.cwd(), "../elsewhere/migrations/12345/hero.js");
    expect(displayPath(filePath)).toBe(filePath);
    expect(displayPath(filePath, "../elsewhere")).toBe(filePath);
  });

  it("should keep a path relative when only its name starts with dots", () => {
    const filePath = join(process.cwd(), "..storyblok/hero.js");
    expect(displayPath(filePath)).toBe("..storyblok/hero.js");
  });
});

describe("applyDefaults", () => {
  it("should inject defaults for missing fields", () => {
    const entity = { name: "page" };
    const defaults = { internal_tag_ids: [], color: "" };
    const result = applyDefaults(entity, defaults);
    expect(result).toEqual({ name: "page", internal_tag_ids: [], color: "" });
  });

  it("should not override existing values", () => {
    const entity = { name: "page", internal_tag_ids: [10, 20] };
    const defaults = { internal_tag_ids: [] };
    const result = applyDefaults(entity, defaults);
    expect(result).toEqual({ name: "page", internal_tag_ids: [10, 20] });
  });

  it("should override null and undefined with defaults", () => {
    const entity = { name: "page", color: null, icon: undefined };
    const defaults = { color: "", icon: "" };
    const result = applyDefaults(entity, defaults);
    expect(result).toEqual({ name: "page", color: "", icon: "" });
  });

  it("should not mutate the original entity", () => {
    const entity = { name: "page" };
    const defaults = { internal_tag_ids: [] };
    applyDefaults(entity, defaults);
    expect(entity).toEqual({ name: "page" });
  });
});
