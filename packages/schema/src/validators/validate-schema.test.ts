import { describe, expect, it } from "vitest";
import { storyblokColorField } from "../field-plugins/storyblok-color-field";
import { defineBlock } from "../helpers/define-block";
import { defineDatasource } from "../helpers/define-datasource";
import { defineField } from "../helpers/define-field";
import { defineFolder } from "../helpers/define-folder";
import type { SchemaBlockLike, SchemaDatasourceLike } from "./shapes";
import { validateSchema } from "./validate-schema";

const colors = defineDatasource({ name: "Colors", slug: "colors" });
const teaser = defineBlock({ name: "teaser", fields: [defineField("text", { type: "text" })] });
const page = defineBlock({
  name: "page",
  is_root: true,
  fields: [
    defineField("body", { type: "bloks", allow: [teaser] }),
    defineField("theme", { type: "option", datasource: colors }),
  ],
});

const codesFor = (result: { issues: { code: string }[] }) => result.issues.map((i) => i.code);

describe("validateSchema", () => {
  it("passes a valid schema with resolvable allow and datasource refs", () => {
    const result = validateSchema({ blocks: { page, teaser }, datasources: { colors } });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("flags duplicate block names", () => {
    const dup = defineBlock({ name: "teaser", fields: [] });
    const result = validateSchema({ blocks: [teaser, dup] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain("duplicate_block_name");
  });

  // A block with no usable name has no identity: it cannot be pushed, nothing can
  // `allow` it, and there is no name to head its issues with. Report the missing
  // name against the schema instead of silently skipping the block.
  it("flags a block whose name is missing or blank", () => {
    const nameless: SchemaBlockLike = { fields: [] } as unknown as SchemaBlockLike;
    const blank: SchemaBlockLike = { name: "   ", fields: [] };
    const result = validateSchema({ blocks: [nameless, blank] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toEqual(["invalid_block_name", "invalid_block_name"]);
    expect(result.issues.map((issue) => [issue.entity, issue.path])).toEqual([
      ["schema", ["blocks", 0]],
      ["schema", ["blocks", 1]],
    ]);
  });

  it("attributes a nameless block's field issues to the schema, located by index", () => {
    const nameless = { fields: [{ type: "text" }] } as unknown as SchemaBlockLike;
    const result = validateSchema({ blocks: [nameless] });
    const missingName = result.issues.find((issue) => issue.code === "missing_field_name");
    expect(missingName?.entity).toBe("schema");
    expect(missingName?.path).toEqual(["blocks", 0, 0]);
    expect(missingName?.message).toContain("the block at index 0");
  });

  it("flags a datasource whose slug is missing or blank", () => {
    const result = validateSchema({ blocks: {}, datasources: [{}, { slug: "" }] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toEqual(["invalid_datasource_slug", "invalid_datasource_slug"]);
    expect(result.issues[0]).toMatchObject({ entity: "schema", path: ["datasources", 0] });
  });

  it("flags duplicate field names within a block", () => {
    // Build the block shape directly to bypass defineBlock's runtime guard.
    const block: SchemaBlockLike = {
      name: "dup",
      fields: [
        { name: "a", type: "text" },
        { name: "a", type: "textarea" },
      ],
    };
    const result = validateSchema({ blocks: [block] });
    expect(codesFor(result)).toContain("duplicate_field_name");
  });

  it("flags duplicate datasource slugs", () => {
    const dup = defineDatasource({ name: "Colors 2", slug: "colors" });
    const result = validateSchema({ blocks: {}, datasources: [colors, dup] });
    expect(codesFor(result)).toContain("duplicate_datasource_slug");
  });

  // Regression: `schema push` diffs datasources by `name`, so this pair aborts
  // the push (`Duplicate schema definitions: datasource name "Colors"`) even
  // though the slugs differ. `validateSchema` only tracked slugs, so `schema
  // validate` reported a clean schema and exited 0 right before that abort.
  it("flags two datasources claiming the same name", () => {
    const dup = defineDatasource({ name: "Colors", slug: "colors-2" });
    const result = validateSchema({ blocks: {}, datasources: [colors, dup] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toEqual(["duplicate_datasource_name"]);
    // Attributed to the second claimant: that is the one that has to be renamed.
    expect(result.issues[0]).toMatchObject({
      entity: "datasource:colors-2",
      path: ["datasources", "colors-2", "name"],
    });
  });

  it("does not flag datasources with distinct names", () => {
    const other = defineDatasource({ name: "Sizes", slug: "sizes" });
    const result = validateSchema({ blocks: {}, datasources: [colors, other] });
    expect(result.ok).toBe(true);
  });

  it("flags a datasource whose name is missing or blank", () => {
    // Bypass defineDatasource, whose input type requires `name`.
    const nameless = { slug: "colors-2" } as SchemaDatasourceLike;
    const result = validateSchema({ blocks: {}, datasources: [colors, nameless] });
    expect(codesFor(result)).toEqual(["invalid_datasource_name"]);
    expect(result.issues[0]).toMatchObject({ entity: "datasource:colors-2" });
  });

  it("flags an allow reference to an unknown block", () => {
    const block = defineBlock({
      name: "page",
      fields: [defineField("body", { type: "bloks", allow: ["ghost"] })],
    });
    const result = validateSchema({ blocks: [block] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain("unresolved_allow");
  });

  it("flags a deny reference to an unknown block", () => {
    const block = defineBlock({
      name: "page",
      fields: [defineField("body", { type: "bloks", deny: ["ghost"] })],
    });
    const result = validateSchema({ blocks: [block] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain("unresolved_deny");
  });

  it("does not flag a folder deny entry as unresolved", () => {
    const legacy = defineFolder({ name: "Legacy" });
    const block = defineBlock({
      name: "page",
      fields: [defineField("body", { type: "bloks", deny: [legacy] })],
    });
    const result = validateSchema({ blocks: [block] });
    expect(codesFor(result)).not.toContain("unresolved_deny");
  });

  it("does not flag a folder allow entry as unresolved", () => {
    const layout = defineFolder({ name: "Layout" });
    const block = defineBlock({
      name: "page",
      fields: [defineField("body", { type: "bloks", allow: [layout] })],
    });
    const result = validateSchema({ blocks: [block] });
    expect(codesFor(result)).not.toContain("unresolved_allow");
  });

  it("flags a datasource reference to an unknown datasource", () => {
    const block = defineBlock({
      name: "page",
      fields: [defineField("theme", { type: "option", datasource: "missing" })],
    });
    const result = validateSchema({ blocks: [block] });
    expect(codesFor(result)).toContain("unresolved_datasource");
  });

  it("resolves a self-referencing (circular) allow without error", () => {
    const section = defineBlock({
      name: "section",
      fields: [defineField("children", { type: "bloks", allow: ["section"] })],
    });
    const result = validateSchema({ blocks: { section } });
    expect(result.ok).toBe(true);
  });

  it("flags a field that is missing a string name (silently dropped by the wire mapper)", () => {
    // Bypass defineField's normalization to model malformed authored input.
    const block = { name: "broken", fields: [{ type: "text" }] } as unknown as SchemaBlockLike;
    const result = validateSchema({ blocks: [block] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain("missing_field_name");
  });

  it("flags a field that is not an object", () => {
    const block = { name: "broken", fields: ["nope"] } as unknown as SchemaBlockLike;
    const result = validateSchema({ blocks: [block] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain("invalid_field");
  });

  it("flags a custom field referencing an unregistered field plugin", () => {
    const block = defineBlock({
      name: "hero",
      fields: [defineField("bg", { type: "custom", field_type: "storyblok-colorpicker" })],
    });
    const result = validateSchema({ blocks: [block] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain("unresolved_field_plugin");
  });

  it("resolves a custom field to a registered field plugin", () => {
    const block = defineBlock({
      name: "hero",
      fields: [defineField("bg", { type: "custom", field_type: "storyblok-colorpicker" })],
    });
    const result = validateSchema({ blocks: [block], fieldPlugins: { storyblokColorField } });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
