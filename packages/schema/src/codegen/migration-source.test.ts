import path from "node:path";
import { describe, expect, it } from "vitest";

import { applyMigration } from "../migrations/apply-migration";
import type { CompiledMigration } from "../migrations/define-migration";
import { writeModules } from "./__tests__/generated-modules";
import { generateMigrationSource } from "./migration-source";
import type { MigrationOpSource } from "./migration-source";

const SCHEMA = [
  "import { defineBlock, defineField, defineSchema } from '@storyblok/schema';",
  "import type { Schema as InferSchema } from '@storyblok/schema';",
  "const hero = defineBlock({ name: 'hero', fields: [",
  "  defineField('title', { type: 'text' }),",
  "  defineField('count', { type: 'number' }),",
  "  defineField('subtitle', { type: 'text', required: true }),",
  "  defineField('cta-label', { type: 'text', required: true }),",
  "  defineField('link', { type: 'multilink' }),",
  "] });",
  "const schema = defineSchema({ blocks: { hero } });",
  "export type Schema = InferSchema<typeof schema>;",
].join("\n");

const OPS: MigrationOpSource[] = [
  { kind: "renameField", block: "hero", field: "headline", to: "title" },
  { kind: "removeField", block: "hero", field: "legacy", todo: ["Removed field: legacy"] },
  { kind: "coerceField", block: "hero", field: "count", from: "string", to: "number" },
  { kind: "addField", block: "hero", field: "subtitle", value: "" },
  { kind: "fillField", block: "hero", field: "cta-label", value: "Read more" },
];

async function loadGenerated(
  options: Parameters<typeof generateMigrationSource>[0],
): Promise<{ migration: CompiledMigration; typeErrors: string[] }> {
  const modules = await writeModules({
    "schema.ts": SCHEMA,
    "0001-update-hero.ts": generateMigrationSource(options),
  });
  try {
    const { default: migration } = await import(
      path.join(modules.directory, "0001-update-hero.ts")
    );
    return { migration, typeErrors: modules.typeErrors() };
  } finally {
    await modules.cleanup();
  }
}

describe("generateMigrationSource", () => {
  it("should generate a migration that typechecks and migrates content", async () => {
    const { migration, typeErrors } = await loadGenerated({
      schemaImport: "./schema",
      title: "Update hero",
      ops: OPS,
    });

    expect(typeErrors).toEqual([]);
    expect(migration.title).toBe("Update hero");

    const outcome = applyMigration({
      migration,
      id: "0001-update-hero",
      space: "1",
      stories: [
        {
          id: 1,
          slug: "home",
          content: {
            _uid: "a",
            component: "hero",
            headline: "Hi",
            legacy: "x",
            count: 3,
            "cta-label": null,
          },
        },
      ],
    });

    expect(outcome.writes[0].content).toEqual({
      _uid: "a",
      component: "hero",
      title: "Hi",
      count: "3",
      subtitle: "",
      "cta-label": "Read more",
    });
  });

  it("should backfill an object value", async () => {
    const link = {
      id: "",
      url: "https://example.com",
      linktype: "url",
      fieldtype: "multilink",
      cached_url: "https://example.com",
    };
    const { migration, typeErrors } = await loadGenerated({
      schemaImport: "./schema",
      ops: [{ kind: "addField", block: "hero", field: "link", value: link }],
    });

    expect(typeErrors).toEqual([]);

    const outcome = applyMigration({
      migration,
      id: "0001-update-hero",
      space: "1",
      stories: [{ id: 1, slug: "home", content: { _uid: "a", component: "hero" } }],
    });

    expect(outcome.writes[0].content).toEqual({ _uid: "a", component: "hero", link });
  });

  it("should fill an empty string when the field stores a string", async () => {
    const { migration, typeErrors } = await loadGenerated({
      schemaImport: "./schema",
      ops: [
        { kind: "fillField", block: "hero", field: "subtitle", value: "Hi", fillEmptyString: true },
        { kind: "fillField", block: "hero", field: "count", value: "0", fillEmptyString: true },
      ],
    });

    expect(typeErrors).toEqual([]);

    const outcome = applyMigration({
      migration,
      id: "0001-update-hero",
      space: "1",
      stories: [
        { id: 1, slug: "home", content: { _uid: "a", component: "hero", subtitle: "", count: "" } },
        { id: 2, slug: "about", content: { _uid: "b", component: "hero", subtitle: "Kept" } },
      ],
    });

    expect(outcome.writes.map((write) => write.content)).toEqual([
      { _uid: "a", component: "hero", subtitle: "Hi", count: "0" },
      { _uid: "b", component: "hero", subtitle: "Kept", count: "0" },
    ]);
  });

  it("should refuse an empty string while the fill is a placeholder", async () => {
    const { migration } = await loadGenerated({
      schemaImport: "./schema",
      ops: [{ kind: "fillField", block: "hero", field: "subtitle", fillEmptyString: true }],
    });

    const outcome = applyMigration({
      migration,
      id: "0001-update-hero",
      space: "1",
      stories: [{ id: 1, slug: "home", content: { _uid: "a", component: "hero", subtitle: "" } }],
    });

    expect(outcome.refusals[0].reason).toContain("hero.subtitle");
  });

  it("should generate a placeholder migration when there are no ops", async () => {
    const { migration, typeErrors } = await loadGenerated({ schemaImport: "./schema", ops: [] });

    expect(typeErrors).toEqual([]);
    expect(migration.ops).toEqual([]);
  });

  it("should generate a placeholder for a conversion it cannot write that compiles and refuses the op", async () => {
    const before = [
      "import { defineBlock, defineField, defineSchema } from '@storyblok/schema';",
      "import type { Schema } from '@storyblok/schema';",
      "const hero = defineBlock({ name: 'hero', fields: [",
      "  defineField('title', { type: 'text' }),",
      "  defineField('count', { type: 'boolean' }),",
      "  defineField('subtitle', { type: 'text' }),",
      "] });",
      "export const schema = defineSchema({ blocks: { hero } });",
      "export type Before = Schema<typeof schema>;",
    ].join("\n");
    const modules = await writeModules({
      "schema.ts": SCHEMA,
      "0001.before.ts": before,
      "0001.ts": generateMigrationSource({
        schemaImport: "./schema",
        beforeImport: "./0001.before",
        ops: [
          { kind: "alterField", block: "hero", field: "count" },
          { kind: "addField", block: "hero", field: "link" },
          { kind: "fillField", block: "hero", field: "subtitle" },
        ],
      }),
    });

    try {
      expect(modules.typeErrors()).toEqual([]);
      const { default: migration } = await import(path.join(modules.directory, "0001.ts"));
      const outcome = applyMigration({
        migration,
        id: "0001",
        space: "1",
        stories: [{ id: 1, slug: "home", content: { _uid: "a", component: "hero", count: true } }],
      });

      expect(outcome.writes).toEqual([]);
      expect(outcome.refusals).toHaveLength(1);
      expect(outcome.refusals[0].reason).toContain(
        "Replace this placeholder for hero.count before applying the migration.",
      );
      expect(outcome.refusals[0].reason).toContain("hero.link");
      expect(outcome.refusals[0].reason).toContain("hero.subtitle");
    } finally {
      await modules.cleanup();
    }
  });

  it("should throw on an op kind it does not know", () => {
    expect(() =>
      generateMigrationSource({
        schemaImport: "./schema",
        // A JavaScript caller is not held to the op union.
        ops: [JSON.parse('{ "kind": "bogus", "block": "hero", "field": "a" }')],
      }),
    ).toThrow(/Unknown migration op kind/);
  });

  it("should keep a todo with line breaks inside its comment", async () => {
    const { migration } = await loadGenerated({
      schemaImport: "./schema",
      ops: [
        {
          kind: "alterField",
          block: "hero",
          field: "title",
          todo: ["convert 'x\nglobalThis.injected = true; //'"],
        },
      ],
    });

    expect(migration.ops).toHaveLength(1);
    expect(Reflect.get(globalThis, "injected")).toBeUndefined();
  });
});
