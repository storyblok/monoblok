import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import { generateMigration } from "./actions";
// Import the main module first to ensure proper initialization
import "../index";
import { migrationsCommand } from "../command";
import {
  fetchComponent,
  fetchComponentGroups,
  fetchComponents,
} from "../../../commands/components";
import { getLogFileContents } from "../../__tests__/helpers";
import { getProgram } from "../../../program";
import type { Component } from "../../components";

vi.mock("../../../commands/components", () => ({
  fetchComponent: vi.fn(),
  fetchComponentGroups: vi.fn(),
  fetchComponents: vi.fn(),
}));

// Spy, not stub: the printed path has to be the path the action really wrote.
vi.mock("./actions", { spy: true });

vi.spyOn(console, "error");
vi.spyOn(console, "warn");

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
  blockSitsInSubfolderOfAllowedFolder() {
    vi.mocked(fetchComponent).mockResolvedValue(mockComponent);
    vi.mocked(fetchComponents).mockResolvedValue([
      { ...mockComponent, component_group_uuid: "heroes-uuid" },
      {
        ...unrelatedComponent,
        name: "page",
        schema: {
          body: {
            type: "bloks",
            pos: 0,
            restrict_components: true,
            component_group_whitelist: ["layout-uuid"],
          },
        },
      },
      {
        ...unrelatedComponent,
        id: 4,
        name: "sidebar",
        schema: {
          widgets: {
            type: "bloks",
            pos: 0,
            restrict_components: true,
            component_group_whitelist: ["widgets-uuid"],
          },
        },
      },
    ]);
    vi.mocked(fetchComponentGroups).mockResolvedValue([
      { name: "Layout", uuid: "layout-uuid", parent_uuid: null },
      { name: "Heroes", uuid: "heroes-uuid", parent_uuid: "layout-uuid" },
      { name: "Widgets", uuid: "widgets-uuid", parent_uuid: null },
    ] as any);
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
    Reflect.set(generateCmd as object, "_optionValues", { format: "js", snapshot: "current" });
  });

  it("should warn that .js migration functions are deprecated", async () => {
    preconditions.componentExists();

    await generate("component-name");

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        ".js migration functions are deprecated and will be removed in the next major version. Pass --format typed --schema <entry-file> to write a typed content migration instead.",
      ),
    );
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
    const NOW = new Date("2026-10-16T09:05:03Z");
    const ID = "20261016090503-component-name";

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      return () => vi.useRealTimers();
    });

    it("should write a defineMigration file and its .before.ts snapshot", async () => {
      preconditions.componentExists();
      preconditions.hasSchemaEntry();

      await generate("component-name", "--format", "typed", "--schema", "src/schema.ts");

      const migration = writtenFile(`migrations/12345/${ID}.ts`);
      const before = writtenFile(`migrations/12345/${ID}.before.ts`);
      expect(migration).toContain("import type { Schema } from '../../../src/schema.js';");
      expect(migration).toContain(`import type { Before } from './${ID}.before.js';`);
      expect(migration).toContain("export default defineMigration<Schema, Before>([");
      expect(before).toContain("defineField('title'");
      expect(before).toContain("defineBlock({ name: 'child', fields: [] })");
      expect(before).not.toContain("name: 'unrelated'");
      expect(before).toMatch(/export const nameOnlyBlocks: string\[\] = \[[^\]]*'unrelated'/);
      for (const file of [`${ID}.ts`, `${ID}.before.ts`]) {
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining(`.storyblok/migrations/12345/${file}`),
        );
      }
    });

    it("should stub a block whose allowed folder holds the block in a subfolder", async () => {
      preconditions.blockSitsInSubfolderOfAllowedFolder();
      preconditions.hasSchemaEntry();

      await generate("component-name", "--format", "typed", "--schema", "src/schema.ts");

      const snapshot = writtenFile(`${ID}.before.ts`);
      expect(snapshot).toContain("defineBlock({ name: 'page', fields: [] })");
      expect(snapshot).not.toContain("name: 'sidebar'");
    });

    it("should name the migration after its creation time and sort it after the existing ones", async () => {
      preconditions.componentExists();
      preconditions.hasSchemaEntry();
      preconditions.hasMigrations("0001-a.ts", "20261016090503-b.ts", "legacy.js");

      await generate(
        "component-name",
        "--format",
        "typed",
        "--schema",
        "src/schema.ts",
        "--suffix",
        "drop-title",
      );

      expect(writtenFile("20261016090504-component-name-drop-title.ts")).toBeDefined();
      expect(writtenFile("20261016090504-component-name-drop-title.before.ts")).toBeDefined();
    });

    it("should skip the snapshot with --no-snapshot", async () => {
      preconditions.componentExists();
      preconditions.hasSchemaEntry();

      await generate(
        "component-name",
        "--format",
        "typed",
        "--schema",
        "src/schema.ts",
        "--no-snapshot",
      );

      expect(writtenFile(`${ID}.ts`)).toContain("defineMigration<Schema>([");
      expect(writtenFile(".before.ts")).toBeUndefined();
    });

    it("should not warn about deprecated .js migration functions", async () => {
      preconditions.componentExists();
      preconditions.hasSchemaEntry();

      await generate("component-name", "--format", "typed", "--schema", "src/schema.ts");

      expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining("deprecated"));
    });

    it("should warn that --no-snapshot needs --format typed", async () => {
      preconditions.componentExists();

      await generate("component-name", "--no-snapshot");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("--no-snapshot has no effect without --format typed."),
      );
    });

    it("should refuse --format typed without --schema", async () => {
      preconditions.componentExists();

      await generate("component-name", "--format", "typed");

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "--format typed types the migration against your schema, so it requires --schema <entry-file>.",
        ),
      );
      expect(Object.keys(vol.toJSON())).not.toContainEqual(
        expect.stringContaining("migrations/12345"),
      );
    });

    it("should refuse --schema without --format typed", async () => {
      preconditions.componentExists();
      preconditions.hasSchemaEntry();

      await generate("component-name", "--schema", "src/schema.ts");

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "--schema types a defineMigration file, so it requires --format typed.",
        ),
      );
      expect(Object.keys(vol.toJSON())).not.toContainEqual(
        expect.stringContaining("migrations/12345"),
      );
    });

    it("should refuse --snapshot before-push without --format typed with one error", async () => {
      preconditions.componentExists();
      vol.fromJSON({
        ".storyblok/schema/changesets/2026-10-16T09-00-00-000Z.json": JSON.stringify({
          timestamp: "2026-10-16T09:00:00.000Z",
          spaceId: 12345,
          remote: { components: [mockComponent], componentFolders: [], datasources: [] },
          changes: [{ type: "component", name: "component-name", action: "update" }],
        }),
      });

      await generate("component-name", "--snapshot", "before-push");

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "--snapshot before-push snapshots the block for a typed content migration, so it requires --format typed.",
        ),
      );
      expect(console.warn).not.toHaveBeenCalled();
      expect(vi.mocked(console.error).mock.calls.flat().join("\n")).not.toContain("No schema push");
      expect(Object.keys(vol.toJSON())).not.toContainEqual(
        expect.stringContaining("migrations/12345"),
      );
    });

    it("should refuse a schema entry that does not exist", async () => {
      preconditions.componentExists();

      await generate("component-name", "--format", "typed", "--schema", "src/missing.ts");

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Schema entry file not found or not a file: src/missing.ts"),
      );
      expect(Object.keys(vol.toJSON())).not.toContainEqual(
        expect.stringContaining("migrations/12345"),
      );
    });

    it("should reject a directory as the schema entry", async () => {
      preconditions.componentExists();
      preconditions.hasSchemaEntry();

      await generate("component-name", "--format", "typed", "--schema", "src");

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Schema entry file not found or not a file: src"),
      );
    });

    describe("after schema push changed the block", () => {
      const pushedAt = "2026-10-16T09:00:00.000Z";
      const changesetFor = (
        spaceId: number,
        changed: string,
        timestamp = pushedAt,
        field = "old_title",
        failed = false,
      ) => ({
        [`.storyblok/schema/changesets/${timestamp.replace(/[:.]/g, "-")}.json`]: JSON.stringify({
          timestamp,
          spaceId,
          remote: {
            components: [
              { ...mockComponent, schema: { [field]: { type: "text", pos: 0 } } },
              childComponent,
            ],
            componentFolders: [],
            datasources: [],
          },
          changes: [
            { type: "component", name: changed, action: "update", ...(failed && { failed }) },
          ],
        }),
      });

      it("should snapshot the block as it was before the push with --snapshot before-push", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        vol.fromJSON(changesetFor(12345, "component-name"));

        await generate(
          "component-name",
          "--format",
          "typed",
          "--schema",
          "src/schema.ts",
          "--snapshot",
          "before-push",
        );

        const before = writtenFile(`${ID}.before.ts`);
        expect(before).toContain("defineField('old_title'");
        expect(before).not.toContain("defineField('title'");
      });

      it.each(["renamed-block", "component-name"])(
        "should snapshot a block a push renamed under its new name when asked for it as %s with --snapshot before-push",
        async (name) => {
          preconditions.componentExists();
          preconditions.hasSchemaEntry();
          vol.fromJSON({
            [`.storyblok/schema/changesets/${pushedAt.replace(/[:.]/g, "-")}.json`]: JSON.stringify(
              {
                timestamp: pushedAt,
                spaceId: 12345,
                remote: {
                  components: [
                    { ...mockComponent, schema: { old_title: { type: "text", pos: 0 } } },
                  ],
                  componentFolders: [],
                  datasources: [],
                },
                changes: [
                  {
                    type: "component",
                    name: "renamed-block",
                    action: "update",
                    before: { ...mockComponent },
                  },
                ],
              },
            ),
          });

          await generate(
            name,
            "--format",
            "typed",
            "--schema",
            "src/schema.ts",
            "--snapshot",
            "before-push",
          );

          const before = writtenFile(".before.ts");
          expect(before).toContain("name: 'renamed-block'");
          expect(before).toContain("defineField('old_title'");
          expect(before).not.toContain("name: 'component-name'");
        },
      );

      it("should snapshot the blocks around the block under the names the same push gave them", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        const card = {
          ...mockComponent,
          name: "card",
          schema: {
            items: {
              type: "bloks",
              pos: 0,
              restrict_components: true,
              component_whitelist: ["promo"],
            },
          },
        };
        vol.fromJSON({
          [`.storyblok/schema/changesets/${pushedAt.replace(/[:.]/g, "-")}.json`]: JSON.stringify({
            timestamp: pushedAt,
            spaceId: 12345,
            remote: {
              components: [card, { ...mockComponent, id: 7, name: "promo", schema: {} }],
              componentFolders: [],
              datasources: [],
            },
            changes: [
              { type: "component", name: "card", action: "update", before: card },
              { type: "component", name: "teaser", action: "update", before: { name: "promo" } },
            ],
          }),
        });

        await generate(
          "card",
          "--format",
          "typed",
          "--schema",
          "src/schema.ts",
          "--snapshot",
          "before-push",
        );

        const before = writtenFile(".before.ts");
        expect(before).toContain("'teaser'");
        expect(before).not.toContain("'promo'");
      });

      it("should use the latest push to the space that changed the block", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        vol.fromJSON({
          ...changesetFor(12345, "component-name"),
          ...changesetFor(12345, "unrelated", "2026-10-16T09:01:00.000Z", "newer_title"),
          ...changesetFor(99999, "component-name", "2026-10-16T09:02:00.000Z", "other_title"),
        });

        await generate(
          "component-name",
          "--format",
          "typed",
          "--schema",
          "src/schema.ts",
          "--snapshot",
          "before-push",
        );

        expect(writtenFile(`${ID}.before.ts`)).toContain("defineField('old_title'");
      });

      it("should skip a push that failed to change the block with --snapshot before-push", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        vol.fromJSON({
          ...changesetFor(12345, "component-name"),
          ...changesetFor(
            12345,
            "component-name",
            "2026-10-16T09:01:00.000Z",
            "failed_title",
            true,
          ),
        });

        await generate(
          "component-name",
          "--format",
          "typed",
          "--schema",
          "src/schema.ts",
          "--snapshot",
          "before-push",
        );

        expect(writtenFile(`${ID}.before.ts`)).toContain("defineField('old_title'");
      });

      it("should not warn about a push that failed to change the block", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        vol.fromJSON(changesetFor(12345, "component-name", pushedAt, "old_title", true));

        await generate("component-name", "--format", "typed", "--schema", "src/schema.ts");

        expect(writtenFile(`${ID}.before.ts`)).toContain("defineField('title'");
        expect(console.warn).not.toHaveBeenCalledWith(
          expect.stringContaining("schema push changed"),
        );
      });

      it("should warn that the snapshot describes the pushed block without --snapshot before-push", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        vol.fromJSON(changesetFor(12345, "component-name"));

        await generate("component-name", "--format", "typed", "--schema", "src/schema.ts");

        expect(writtenFile(`${ID}.before.ts`)).toContain("defineField('title'");
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            `schema push changed component-name at ${pushedAt}, so the snapshot describes the block after that push. Pass --snapshot before-push to snapshot it as it was before.`,
          ),
        );
      });

      const createdBy = (changed: string) => ({
        [`.storyblok/schema/changesets/${pushedAt.replace(/[:.]/g, "-")}.json`]: JSON.stringify({
          timestamp: pushedAt,
          spaceId: 12345,
          remote: { components: [childComponent], componentFolders: [], datasources: [] },
          changes: [{ type: "component", name: changed, action: "create" }],
        }),
      });

      it("should not suggest --snapshot before-push for a block the push created", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        vol.fromJSON(createdBy("component-name"));

        await generate("component-name", "--format", "typed", "--schema", "src/schema.ts");

        expect(writtenFile(`${ID}.before.ts`)).toContain("defineField('title'");
        expect(console.warn).not.toHaveBeenCalledWith(
          expect.stringContaining("--snapshot before-push"),
        );
      });

      it("should refuse --snapshot before-push for a block the push created", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        vol.fromJSON(createdBy("component-name"));

        await generate(
          "component-name",
          "--format",
          "typed",
          "--schema",
          "src/schema.ts",
          "--snapshot",
          "before-push",
        );

        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining(
            `component-name didn't exist before the schema push at ${pushedAt}, so there is no earlier state to snapshot. Run without --snapshot before-push.`,
          ),
        );
        expect(writtenFile(`${ID}.ts`)).toBeUndefined();
      });

      it("should generate the migration when a changeset can't be read", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        vol.fromJSON({ ".storyblok/schema/changesets/2026-10-16T09-00-00-000Z.json": "{" });

        await generate("component-name", "--format", "typed", "--schema", "src/schema.ts");

        expect(writtenFile(`${ID}.ts`)).toContain("defineMigration<Schema, Before>([");
        expect(writtenFile(`${ID}.before.ts`)).toContain("defineField('title'");
      });

      it("should not warn about a push older than the space's newest content migration", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        preconditions.hasMigrations("20261016090000-update-component-name.ts");
        vol.fromJSON(changesetFor(12345, "component-name"));

        await generate("component-name", "--format", "typed", "--schema", "src/schema.ts");

        expect(writtenFile(`${ID}.before.ts`)).toBeDefined();
        expect(console.warn).not.toHaveBeenCalledWith(
          expect.stringContaining("schema push changed"),
        );
      });

      it("should warn about a push whose only newer content migration is one the push wrote", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        preconditions.hasMigrations("20261016090000-update-component-name.ts");
        const changeset = JSON.parse(Object.values(changesetFor(12345, "component-name"))[0]);
        vol.fromJSON({
          [`.storyblok/schema/changesets/${pushedAt.replace(/[:.]/g, "-")}.json`]: JSON.stringify({
            ...changeset,
            migrations: ["20261016090000-update-component-name"],
          }),
        });

        await generate("component-name", "--format", "typed", "--schema", "src/schema.ts");

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining(`schema push changed component-name at ${pushedAt}`),
        );
      });

      it("should warn about a push newer than the space's newest content migration", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        preconditions.hasMigrations("20261016085959-card.ts", "0001-legacy-numbering.ts");
        vol.fromJSON(changesetFor(12345, "component-name"));

        await generate("component-name", "--format", "typed", "--schema", "src/schema.ts");

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining(`schema push changed component-name at ${pushedAt}`),
        );
      });

      it("should refuse --snapshot before-push when no push to the space changed the block", async () => {
        preconditions.componentExists();
        preconditions.hasSchemaEntry();
        vol.fromJSON(changesetFor(99999, "component-name"));

        await generate(
          "component-name",
          "--format",
          "typed",
          "--schema",
          "src/schema.ts",
          "--snapshot",
          "before-push",
        );

        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining(
            "No schema push to space 12345 recorded a change to component-name",
          ),
        );
        expect(writtenFile(`${ID}.ts`)).toBeUndefined();
      });
    });

    it("should refuse to write next to a leftover snapshot, even without a snapshot of its own", async () => {
      preconditions.componentExists();
      preconditions.hasSchemaEntry();
      preconditions.hasMigrations(`${ID}.before.ts`);

      await generate(
        "component-name",
        "--format",
        "typed",
        "--schema",
        "src/schema.ts",
        "--no-snapshot",
      );

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`.storyblok/migrations/12345/${ID}.before.ts already exists`),
      );
      expect(writtenFile(`${ID}.ts`)).toBeUndefined();
    });
  });
});
