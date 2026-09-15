import { describe, expect, it } from "vitest";
import {
  buildMigrationFilename,
  isLegacyMigrationFilename,
  migrationFilterMatches,
  migrationTargetsComponent,
} from "./migration-filename";

describe("buildMigrationFilename", () => {
  it("should name the file after the component", () => {
    expect(buildMigrationFilename("hero")).toBe("hero.js");
    expect(buildMigrationFilename("hero", "v2")).toBe("hero.v2.js");
  });

  it("should give components that sanitize alike distinct file names", () => {
    const names = ["hero:v2", "hero/v2", "hero?v2", "hero_v2"];
    const filenames = names.map((name) => buildMigrationFilename(name));

    expect(new Set(filenames).size).toBe(names.length);
    expect(filenames.every((filename) => filename.startsWith("hero_v2"))).toBe(true);
  });

  it("should leave unambiguous file-safe names untouched", () => {
    expect(buildMigrationFilename("café")).toBe("café.js");
    expect(buildMigrationFilename("hero-v2")).toBe("hero-v2.js");
  });

  it("should disambiguate a name a suffix could be mistaken for", () => {
    expect(buildMigrationFilename("my.component")).toBe("my.component-2e0a80.js");
    expect(buildMigrationFilename(".hero")).toBe(".hero-3a1ad7.js");
  });
});

describe("migrationTargetsComponent", () => {
  it("should match the file generated for a component", () => {
    for (const name of ["hero", "hero:v2", "café", "my.component", ".hero", "con"]) {
      expect(migrationTargetsComponent(buildMigrationFilename(name), name)).toBe(true);
      expect(migrationTargetsComponent(buildMigrationFilename(name, "v2"), name)).toBe(true);
    }
  });

  it("should not match a component whose name only sanitizes alike", () => {
    expect(migrationTargetsComponent(buildMigrationFilename("hero:v2"), "hero_v2")).toBe(false);
    expect(migrationTargetsComponent(buildMigrationFilename("hero_v2"), "hero:v2")).toBe(false);
  });

  it("should not match a component that only shares a leading dot segment", () => {
    expect(migrationTargetsComponent("my.component.js", "my.other")).toBe(false);
    expect(migrationTargetsComponent(".hero.js", ".other")).toBe(false);
  });

  it("should read a suffixed file name as a suffix rather than a dotted component", () => {
    expect(migrationTargetsComponent("my.component.js", "my")).toBe(true);
    expect(migrationTargetsComponent("my.component.js", "my.component")).toBe(false);
  });

  it("should still match a file an older CLI version wrote under the raw name", () => {
    expect(migrationTargetsComponent("hero:v2.js", "hero:v2")).toBe(true);
    expect(migrationTargetsComponent("hero:v2.cleanup.js", "hero:v2")).toBe(true);
    expect(migrationTargetsComponent("hero:v2.js", "hero_v2")).toBe(false);
  });

  it("should match a file written in a different unicode normalization", () => {
    expect(migrationTargetsComponent("café.js".normalize("NFD"), "café".normalize("NFC"))).toBe(
      true,
    );
  });

  it("should not match a non-string component name", () => {
    expect(migrationTargetsComponent("hero.js", undefined)).toBe(false);
    expect(migrationTargetsComponent(".js", "")).toBe(false);
  });
});

describe("isLegacyMigrationFilename", () => {
  it("should recognize a file name an older CLI version wrote verbatim", () => {
    expect(isLegacyMigrationFilename("hero:v2.js")).toBe(true);
    expect(isLegacyMigrationFilename("hero:v2.cleanup.js")).toBe(true);
  });

  it("should not flag a file name the current naming rules produce", () => {
    expect(isLegacyMigrationFilename("hero.js")).toBe(false);
    expect(isLegacyMigrationFilename("hero_v2-c07e5b.js")).toBe(false);
    expect(isLegacyMigrationFilename("my.component.js")).toBe(false);
    expect(isLegacyMigrationFilename("café.js")).toBe(false);
  });
});

describe("migrationFilterMatches", () => {
  const filename = buildMigrationFilename("hero:v2");

  it("should match a glob written against the file name", () => {
    expect(migrationFilterMatches(filename, "hero_v2*")).toBe(true);
    expect(migrationFilterMatches(filename, "feature*")).toBe(false);
  });

  it("should match a glob written against the component name", () => {
    expect(migrationFilterMatches(filename, "hero:v2*")).toBe(true);
    expect(migrationFilterMatches(filename, "hero:v2")).toBe(true);
  });

  it("should match a file an older version generated under the raw name", () => {
    expect(migrationFilterMatches("hero:v2.js", "hero:v2*")).toBe(true);
    expect(migrationFilterMatches("hero:v2.js", "hero_v2*")).toBe(false);
  });

  it("should not match an unrelated component that sanitizes alike", () => {
    expect(migrationFilterMatches(buildMigrationFilename("hero_v2"), "hero:v2")).toBe(false);
  });
});
