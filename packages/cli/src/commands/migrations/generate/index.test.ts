import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import { generateMigration } from "./actions";
// Import the main module first to ensure proper initialization
import "../index";
import { migrationsCommand } from "../command";
import { fetchComponent, fetchComponents } from "../../../commands/components";
import { getLogFileContents } from "../../__tests__/helpers";
import { getProgram } from "../../../program";
import type { Component } from "../../components";

vi.mock("../../../commands/components", () => ({
  fetchComponent: vi.fn(),
  fetchComponents: vi.fn(),
}));

// Spy, not stub: the printed path has to be the path the action really wrote.
vi.mock("./actions", { spy: true });

vi.spyOn(console, "error");

const LOG_PREFIX = "storyblok-migrations-generate-";
const MIGRATIONS_DIRECTORY = ".storyblok/migrations/12345";

const generate = (...args: string[]) =>
  migrationsCommand.parseAsync(["node", "test", "generate", ...args, "--space", "12345"]);

function writtenFile(suffix: string): string | undefined {
  const entry = Object.entries(vol.toJSON()).find(([file]) => file.endsWith(suffix));
  return entry?.[1] ?? undefined;
}

const mockComponent: Component = {
  name: "component-name",
  display_name: "Component Name",
  created_at: "2021-08-09T12:00:00Z",
  updated_at: "2021-08-09T12:00:00Z",
  id: 12345,
  is_root: false,
  is_nestable: true,
  schema: {
    field1: {
      type: "bloks",
      restrict_type: "tags",
      component_tag_whitelist: [1, 2],
    },
  },
};

const childComponent: Component = { ...mockComponent, id: 2, name: "child", schema: {} };
const unrelatedComponent: Component = { ...mockComponent, id: 3, name: "unrelated", schema: {} };

const preconditions = {
  componentExists() {
    vi.mocked(fetchComponent).mockResolvedValue(mockComponent);
    vi.mocked(fetchComponents).mockResolvedValue([
      {
        ...mockComponent,
        schema: {
          title: { type: "text", pos: 0 },
          body: {
            type: "bloks",
            pos: 1,
            restrict_components: true,
            component_whitelist: ["child"],
          },
        },
      },
      childComponent,
      unrelatedComponent,
    ]);
  },
  hasSchemaEntry() {
    vol.fromJSON({ "src/schema.ts": "export type Schema = {};" });
  },
  hasMigrations(...filenames: string[]) {
    vol.fromJSON(
      Object.fromEntries(filenames.map((name) => [`${MIGRATIONS_DIRECTORY}/${name}`, ""])),
    );
  },
  componentWithUnsafeNameExists() {
    vi.mocked(fetchComponent).mockResolvedValue({ ...mockComponent, name: "hero:v2" });
  },
  componentMissing() {
    vi.mocked(fetchComponent).mockResolvedValue(undefined);
  },
};

describe("migrations generate command", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    getProgram().setOptionValueWithSource("path", undefined, "default");
    const generateCmd = migrationsCommand.commands.find((command) => command.name() === "generate");
    Reflect.set(generateCmd as object, "_optionValues", { before: true });
  });

  it("should generate a migration using default path", async () => {
    preconditions.componentExists();

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "generate",
      "component-name",
      "--space",
      "12345",
    ]);

    expect(generateMigration).toHaveBeenCalledWith(
      "12345",
      undefined,
      expect.objectContaining({ name: "component-name" }),
      undefined,
    );
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain("Migration generation finished");
    expect(logFile).toContain(".storyblok/migrations/12345/component-name.js");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "You can find the migration file in .storyblok/migrations/12345/component-name.js",
      ),
    );
  });

  it("should report the sanitized path it wrote for a name that is not filename-safe", async () => {
    preconditions.componentWithUnsafeNameExists();

    await migrationsCommand.parseAsync(["node", "test", "generate", "hero:v2", "--space", "12345"]);

    expect(Object.keys(vol.toJSON())).toEqual(
      expect.arrayContaining([expect.stringContaining("migrations/12345/hero_v2-c07e5b.js")]),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "You can find the migration file in .storyblok/migrations/12345/hero_v2-c07e5b.js",
      ),
    );
  });

  it("should generate a migration using custom path", async () => {
    preconditions.componentExists();

    const program = getProgram();
    program.setOptionValueWithSource("path", "custom", "cli");

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "generate",
      "component-name",
      "--space",
      "12345",
    ]);

    expect(generateMigration).toHaveBeenCalledWith(
      "12345",
      "custom",
      expect.objectContaining({ name: "component-name" }),
      undefined,
    );
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain("Migration generation finished");
    expect(logFile).toContain("custom/migrations/12345/component-name.js");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "You can find the migration file in custom/migrations/12345/component-name.js",
      ),
    );
  });

  it("should handle missing component gracefully", async () => {
    preconditions.componentMissing();

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "generate",
      "component-name",
      "--space",
      "12345",
    ]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No component found with name "component-name"'),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("For more information about the error"),
    );
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain("No component found with name");
  });

  it.each(["../../../tmp/evil", "nested/suffix", "a:b", ".."])(
    "should reject the suffix %s, which is not a file name",
    async (suffix) => {
      preconditions.componentExists();

      await migrationsCommand.parseAsync([
        "node",
        "test",
        "generate",
        "component-name",
        "--space",
        "12345",
        "--suffix",
        suffix,
      ]);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`Invalid suffix "${suffix}"`),
      );
      expect(Object.keys(vol.toJSON())).not.toContainEqual(
        expect.stringContaining("component-name"),
      );
    },
  );

  it("should generate a migration with a suffix that is a file name", async () => {
    preconditions.componentExists();

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "generate",
      "component-name",
      "--space",
      "12345",
      "--suffix",
      "field-name-change",
    ]);

    expect(Object.keys(vol.toJSON())).toContainEqual(
      expect.stringContaining("migrations/12345/component-name.field-name-change.js"),
    );
  });

  it("should require component name", async () => {
    await migrationsCommand.parseAsync(["node", "test", "generate", "--space", "12345"]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Please provide the component name as argument"),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("For more information about the error"),
    );
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain("Please provide the component name as argument");
  });

  describe("with a schema entry", () => {
    it("should write a defineMigration file and its .before.ts snapshot", async () => {
      preconditions.componentExists();
      preconditions.hasSchemaEntry();

      await generate("component-name", "--schema", "src/schema.ts");

      const migration = writtenFile("migrations/12345/0001-component-name.ts");
      const snapshot = writtenFile("migrations/12345/0001-component-name.before.ts");
      expect(migration).toContain("import type { Schema } from '../../../src/schema';");
      expect(migration).toContain("import type { Before } from './0001-component-name.before';");
      expect(migration).toContain("export default defineMigration<Schema, Before>([");
      expect(snapshot).toContain("defineField('title'");
      expect(snapshot).toContain("defineBlock({ name: 'child', fields: [] })");
      expect(snapshot).not.toContain("unrelated");
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "You can find the migration file in .storyblok/migrations/12345/0001-component-name.ts",
        ),
      );
    });

    it("should number the migration after the existing ones", async () => {
      preconditions.componentExists();
      preconditions.hasSchemaEntry();
      preconditions.hasMigrations("0001-a.ts", "0001-a.before.ts", "0002-b.ts", "legacy.js");

      await generate("component-name", "--schema", "src/schema.ts", "--suffix", "drop-title");

      expect(writtenFile("0003-component-name-drop-title.ts")).toBeDefined();
      expect(writtenFile("0003-component-name-drop-title.before.ts")).toBeDefined();
    });

    it("should skip the snapshot with --no-before", async () => {
      preconditions.componentExists();
      preconditions.hasSchemaEntry();

      await generate("component-name", "--schema", "src/schema.ts", "--no-before");

      expect(writtenFile("0001-component-name.ts")).toContain("defineMigration<Schema>([");
      expect(writtenFile(".before.ts")).toBeUndefined();
    });

    it("should write a legacy migration with --js", async () => {
      preconditions.componentExists();
      preconditions.hasSchemaEntry();

      await generate("component-name", "--schema", "src/schema.ts", "--js");

      expect(writtenFile("migrations/12345/component-name.js")).toContain(
        "export default function (block)",
      );
      expect(writtenFile("0001-component-name.ts")).toBeUndefined();
    });

    it("should refuse a schema entry that does not exist", async () => {
      preconditions.componentExists();

      await generate("component-name", "--schema", "src/missing.ts");

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Schema entry file not found: src/missing.ts"),
      );
      expect(Object.keys(vol.toJSON())).not.toContainEqual(
        expect.stringContaining("migrations/12345"),
      );
    });

    it("should refuse to overwrite a leftover snapshot", async () => {
      preconditions.componentExists();
      preconditions.hasSchemaEntry();
      preconditions.hasMigrations("0001-component-name.before.ts");

      await generate("component-name", "--schema", "src/schema.ts");

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("already exists"));
      expect(writtenFile("0001-component-name.ts")).toBeUndefined();
    });
  });
});
