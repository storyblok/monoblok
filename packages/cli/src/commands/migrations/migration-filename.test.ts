import { describe, expect, it } from "vitest";
import { buildMigrationFilename, migrationTargetsComponent } from "./migration-filename";

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

  it("should leave file-safe names untouched", () => {
    expect(buildMigrationFilename("café")).toBe("café.js");
    expect(buildMigrationFilename("my.component")).toBe("my.component.js");
    expect(buildMigrationFilename(".hero")).toBe(".hero.js");
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
