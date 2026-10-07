import { describe, expect, it } from "vitest";

import { writeModules } from "./__tests__/generated-modules";
import { generateMigrationSource } from "./migration-source";
import { generateSnapshot } from "./snapshot";
import type { WireComponent } from "./snapshot";

const GROUP_SEO = "8f2b5d0e-seo";
const TAG_PROMO = 42;

const article: WireComponent = {
  name: "article",
  is_root: true,
  is_nestable: false,
  schema: {
    title: { id: 1, pos: 0, type: "text", required: true },
    author: { id: 2, pos: 1, type: "text" },
    body: {
      id: 3,
      pos: 2,
      type: "bloks",
      restrict_components: true,
      component_whitelist: ["card"],
    },
    meta: {
      pos: 3,
      type: "bloks",
      restrict_components: true,
      component_whitelist: [],
      component_group_whitelist: [GROUP_SEO],
    },
  },
};
const card: WireComponent = {
  name: "card",
  is_nestable: true,
  schema: {
    headline: { pos: 0, type: "text" },
    badges: { pos: 1, type: "bloks", restrict_components: true, component_whitelist: ["badge"] },
  },
};
const badge: WireComponent = { name: "badge", schema: { label: { pos: 0, type: "text" } } };
const seo: WireComponent = {
  name: "seo",
  component_group_uuid: GROUP_SEO,
  schema: { og_title: { pos: 0, type: "text" } },
};
const footer: WireComponent = { name: "footer", schema: { note: { pos: 0, type: "text" } } };

const components = [article, card, badge, seo, footer];

function blockNames(source: string): string[] {
  return [...source.matchAll(/defineBlock\(\{\s+name: '([^']+)'/g)].map((m) => m[1]);
}

describe("generateSnapshot", () => {
  it("should emit the read block with its fields and every block it reaches as a stub", () => {
    const source = generateSnapshot({ components, reads: ["article"] });

    expect(blockNames(source)).toEqual(["article", "badge", "card", "seo"]);
    expect(source).toContain("defineField('author', {\n      type: 'text',\n    })");
    expect(source).toContain("defineBlock({ name: 'card', fields: [] })");
    expect(source).not.toContain("footer");
  });

  it("should flatten folder and name restrictions to block-name allow lists", () => {
    const source = generateSnapshot({ components, reads: ["article"] });

    expect(source).toContain("allow: [\n        'card',\n      ]");
    expect(source).toContain("allow: [\n        'seo',\n      ]");
    expect(source).not.toMatch(/component_group_whitelist|restrict_components|\bid:|\bpos:/);
  });

  it("should reach the blocks carrying a whitelisted tag", () => {
    const promo: WireComponent = { name: "promo", internal_tag_ids: [TAG_PROMO], schema: {} };
    const page: WireComponent = {
      name: "page",
      schema: {
        body: {
          type: "bloks",
          restrict_components: true,
          restrict_type: "tags",
          component_tag_whitelist: [TAG_PROMO],
        },
      },
    };

    const source = generateSnapshot({ components: [page, promo, footer], reads: ["page"] });

    expect(blockNames(source)).toEqual(["page", "promo"]);
  });

  it("should not follow a denylist, which admits every block it does not name", () => {
    const page: WireComponent = {
      name: "page",
      schema: {
        body: { type: "bloks", restrict_components: true, component_denylist: ["footer"] },
      },
    };

    const source = generateSnapshot({ components: [page, ...components], reads: ["page"] });

    expect(blockNames(source)).toEqual(["page"]);
  });

  it("should terminate on blocks that whitelist each other", () => {
    const a: WireComponent = {
      name: "a",
      schema: { kids: { type: "bloks", restrict_components: true, component_whitelist: ["b"] } },
    };
    const b: WireComponent = {
      name: "b",
      schema: { kids: { type: "bloks", restrict_components: true, component_whitelist: ["a"] } },
    };

    expect(blockNames(generateSnapshot({ components: [a, b], reads: ["a", "b"] }))).toEqual([
      "a",
      "b",
    ]);
  });

  it("should compile when the space holds options the editor no longer writes", async () => {
    const legacy: WireComponent = {
      name: "legacy",
      schema: {
        title: { type: "text", max_length: "80", key: "headline" },
        flag: { type: "boolean", default_value: "", source: "internal_stories" },
        size: { type: "option", options: [{ name: "Small", value: 1 }] },
        body: { type: "richtext", toolbar: ["list"], customize_toolbar: true },
      },
    };
    const modules = await writeModules({
      "legacy.before.ts": generateSnapshot({ components: [legacy], reads: ["legacy"] }),
    });

    try {
      expect(modules.typeErrors()).toEqual([]);
    } finally {
      await modules.cleanup();
    }
  });

  it("should type a migration against the schema it was taken from", async () => {
    const modules = await writeModules({
      "schema.ts": [
        "import { defineBlock, defineField, defineSchema } from '@storyblok/schema';",
        "import type { Schema as InferSchema } from '@storyblok/schema';",
        "const article = defineBlock({ name: 'article', is_root: true, is_nestable: false, fields: [",
        "  defineField('title', { type: 'text', required: true }),",
        "  defineField('byline', { type: 'text' }),",
        "] });",
        "const schema = defineSchema({ blocks: { article } });",
        "export type Schema = InferSchema<typeof schema>;",
      ].join("\n"),
      "0001-rename-author.before.ts": generateSnapshot({ components, reads: ["article"] }),
      "0001-rename-author.ts": generateMigrationSource({
        schemaImport: "./schema",
        beforeImport: "./0001-rename-author.before",
        ops: [{ kind: "renameField", block: "article", field: "author", to: "byline" }],
      }),
      "0002-typo.ts": generateMigrationSource({
        schemaImport: "./schema",
        beforeImport: "./0001-rename-author.before",
        ops: [{ kind: "renameField", block: "article", field: "auhtor", to: "byline" }],
      }),
    });

    try {
      const errors = modules.typeErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/auhtor/);
    } finally {
      await modules.cleanup();
    }
  });
});
