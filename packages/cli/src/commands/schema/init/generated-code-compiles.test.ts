import { fileURLToPath } from "node:url";
import { dirname, join } from "pathe";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { validateSchema } from "../../../lib/validation";
import type { SchemaLike } from "../../../lib/validation";
import type { Component, ComponentFolder } from "../../../types";
import { mapFieldToWire } from "../map-to-wire";
import {
  generateComponentFile,
  generateFoldersFile,
  generateSchemaFile,
  resolveComponents,
  resolveFolders,
} from "./generate-code";

/**
 * Directory the generated files are compiled as if they lived in, so
 * `@storyblok/schema` resolves to this workspace's package the way it resolves to
 * the installed one in a project. The files themselves stay in memory.
 */
const VIRTUAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "__generated__");

/** Type-checks in-memory sources against the real `@storyblok/schema` types. */
function typeErrors(files: Record<string, string>): string[] {
  const sources = new Map(
    Object.entries(files).map(([name, source]) => [join(VIRTUAL_ROOT, name), source]),
  );
  const options: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
    strict: true,
    noEmit: true,
    noUnusedLocals: true,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const { fileExists, readFile, getSourceFile, directoryExists } = host;
  const virtualDirectories = new Set([...sources.keys()].map((fileName) => dirname(fileName)));
  host.fileExists = (fileName) => sources.has(fileName) || fileExists(fileName);
  host.directoryExists = (directory) =>
    virtualDirectories.has(directory) || (directoryExists?.(directory) ?? false);
  host.readFile = (fileName) => sources.get(fileName) ?? readFile(fileName);
  host.getSourceFile = (fileName, languageVersion, ...rest) => {
    const source = sources.get(fileName);
    return source === undefined
      ? getSourceFile(fileName, languageVersion, ...rest)
      : ts.createSourceFile(fileName, source, languageVersion);
  };
  const program = ts.createProgram([...sources.keys()], options, host);
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const location =
      diagnostic.file && diagnostic.start !== undefined
        ? `${diagnostic.file.fileName.slice(VIRTUAL_ROOT.length + 1)}:${diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1}: `
        : "";
    return location + ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  });
}

/** Generates the files `schema init` writes for `components`, keyed by path. */
function generateProject(
  components: Component[],
  folders: ComponentFolder[] = [],
  tags: { id: number; name: string }[] = [],
): Record<string, string> {
  const resolvedFolders = resolveFolders(folders);
  const folderVarByUuid = new Map(resolvedFolders.map((r) => [r.folder.uuid, r.varName]));
  const tagNameById = new Map(tags.map((tag) => [String(tag.id), tag.name]));
  const resolved = resolveComponents(
    components,
    components.map(() => []),
  );
  const files: Record<string, string> = {
    "schema.ts": generateSchemaFile(resolved, [], resolvedFolders),
  };
  if (resolvedFolders.length > 0) {
    files["folders.ts"] = generateFoldersFile(resolvedFolders);
  }
  for (const { component, varName, fileName } of resolved) {
    files[`blocks/${fileName}.ts`] = generateComponentFile(
      component,
      varName,
      undefined,
      folderVarByUuid,
      tagNameById,
    );
  }
  return files;
}

/** Runs a generated block file with pass-through `defineBlock` and `defineField`. */
function evaluateBlock(code: string): { name: string; fields: Record<string, unknown>[] } {
  const { outputText } = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const exports: Record<string, { name: string; fields: Record<string, unknown>[] }> = {};
  const schemaModule = {
    defineBlock: (block: unknown) => block,
    defineField: (name: string, field: object) => ({ name, ...field }),
  };
  new Function("require", "exports", outputText)(() => schemaModule, exports);
  return Object.values(exports)[0];
}

const evaluateFields = (code: string): Record<string, unknown>[] => evaluateBlock(code).fields;

const component = (name: string, schema: Record<string, Record<string, unknown>>): Component =>
  ({ id: 1, name, created_at: "", updated_at: "", schema }) as unknown as Component;

/**
 * A space's fields as the Management API returns them: options left behind by a
 * field type change, numbers and booleans stored as strings, tag lists beside a
 * name restriction, and rich text toolbar items.
 */
const LEGACY_SPACE: Component[] = [
  component("article", {
    title: {
      type: "text",
      pos: 0,
      key: "title",
      required: "false",
      customize_toolbar: true,
      toolbar: ["bold"],
    },
    intro: { type: "textarea", pos: 1, key: "teaser", customize_toolbar: true, toolbar: [] },
    noindex: { type: "boolean", pos: 2, default_value: "", use_uuid: true },
    featured: { type: "boolean", pos: 3, default_value: "true" },
    rating: { type: "number", pos: 4, key: "rating" },
    cover: { type: "asset", pos: 5, key: "cover", filetypes: ["images"] },
    settings: { type: "tab", pos: 6, name: "settings", key: "settings", keys: ["noindex"] },
    legacy: { type: "text", pos: 7, legacy_flag: 1 },
    body: { type: "markdown", pos: 8, rich_markdown: "true" },
    link: { type: "multilink", pos: 9, asset_folder_id: 123 },
    widget: { type: "custom", pos: 10, field_type: "color-picker", required: "true", color: "red" },
  }),
  component("listing", {
    decoration: {
      type: "option",
      pos: 0,
      source: "internal",
      datasource_slug: "decorations",
      use_uuid: true,
      filetypes: ["images"],
    },
    authors: {
      type: "options",
      pos: 1,
      source: "internal_stories",
      max_options: 4,
      min_options: "1",
      max_length: 3,
      minimum: 0,
      maximum: 1,
      component_whitelist: ["pricing_section"],
      restrict_components: true,
      restrict_type: "",
    },
    items: {
      type: "bloks",
      pos: 2,
      component_whitelist: ["card"],
      restrict_components: true,
      restrict_type: "",
      maximum: "2",
      minimum: "",
      filetypes: ["images"],
      source: "internal_stories",
      folder_slug: "docs/",
      use_uuid: true,
    },
    text: {
      type: "richtext",
      pos: 3,
      customize_toolbar: true,
      toolbar: ["bold", "background-color", "add-table", "toggle-header-row", "split-cells"],
      restrict_components: true,
      restrict_type: "",
      component_whitelist: ["card"],
      component_tag_whitelist: [1],
      component_tag_denylist: [2],
    },
  }),
  component("card", { headline: { type: "text", pos: 0, key: "headline" } }),
  component("pricing_section", { name: { type: "text", pos: 0 } }),
];

describe("schema init generated code", () => {
  it("should type-check for a space holding legacy field options", () => {
    const files = generateProject(
      LEGACY_SPACE,
      [],
      [
        { id: 1, name: "Marketing" },
        { id: 2, name: "Legacy" },
      ],
    );

    expect(typeErrors(files)).toEqual([]);
  });

  it("should type-check blocks without fields", () => {
    const withoutSchema = {
      id: 2,
      name: "divider",
      created_at: "",
      updated_at: "",
    } as unknown as Component;
    const files = generateProject([component("listing_placeholder", {}), withoutSchema]);

    expect(typeErrors(files)).toEqual([]);
  });

  it("should reject an unknown option written by hand", () => {
    // Guards the check above: it must be able to fail.
    const files = generateProject([component("page", { title: { type: "text", pos: 0 } })]);
    files["blocks/page.ts"] = files["blocks/page.ts"].replace(
      "type: 'text',",
      "type: 'text',\n      toolbar: ['bold'],",
    );

    const errors = typeErrors(files);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(String.raw`unknown option \"toolbar\" for this field type`);
  });

  it("should push options the field type does not declare back unchanged", () => {
    const files = generateProject(LEGACY_SPACE);
    const fields = evaluateFields(files["blocks/article.ts"]);
    const legacy = fields.find((field) => field.name === "legacy");

    expect(mapFieldToWire(legacy ?? {}).value).toEqual({ type: "text", legacy_flag: 1 });
  });

  it("should pass schema validation", async () => {
    const files = generateProject(LEGACY_SPACE);
    const blocks = Object.entries(files)
      .filter(([path]) => path.startsWith("blocks/"))
      .map(([, code]) => evaluateBlock(code));

    // Typed as runtime values, which the type check above already covers.
    const result = await validateSchema({ blocks } as unknown as SchemaLike);

    // The fixture registers no datasources or field plugins.
    const fixtureGaps = new Set(["unresolved_datasource", "unresolved_field_plugin"]);
    expect(
      result.issues.filter((issue) => issue.severity === "error" && !fixtureGaps.has(issue.code)),
    ).toEqual([]);
  });

  it("should push tag lists beside a block name restriction back unchanged", () => {
    const files = generateProject(LEGACY_SPACE);
    const fields = evaluateFields(files["blocks/listing.ts"]);
    const text = fields.find((field) => field.name === "text");

    expect(mapFieldToWire(text ?? {}).value).toMatchObject({
      component_whitelist: ["card"],
      component_tag_whitelist: [1],
      component_tag_denylist: [2],
      restrict_components: true,
      restrict_type: "",
    });
  });

  it("should push numbers and booleans stored as strings as the editor reads them", () => {
    const files = generateProject(LEGACY_SPACE);
    const listing = evaluateFields(files["blocks/listing.ts"]);
    const article = evaluateFields(files["blocks/article.ts"]);
    const field = (fields: Record<string, unknown>[], name: string) =>
      fields.find((candidate) => candidate.name === name);

    expect(field(listing, "items")).toMatchObject({ maximum: 2 });
    expect(field(listing, "items")).not.toHaveProperty("minimum");
    // The editor reads `required` by truthiness, so "false" means required.
    expect(field(article, "title")).toMatchObject({ required: true });
    // It enables these two only on a literal `true`, so a string means off.
    expect(field(article, "featured")).not.toHaveProperty("default_value");
    expect(field(article, "body")).not.toHaveProperty("rich_markdown");
    expect(field(article, "noindex")).not.toHaveProperty("default_value");
    expect(field(article, "widget")).toMatchObject({ required: true, color: "red" });
  });

  it("should push options left behind by a field type change back unchanged", () => {
    const files = generateProject(LEGACY_SPACE);
    const fields = [
      ...evaluateFields(files["blocks/article.ts"]),
      ...evaluateFields(files["blocks/listing.ts"]),
    ];
    const wire = Object.fromEntries(
      fields.map((field) => [field.name, mapFieldToWire(field).value]),
    );

    expect(wire.title).toEqual({
      type: "text",
      required: true,
      customize_toolbar: true,
      toolbar: ["bold"],
    });
    expect(wire.link).toEqual({ type: "multilink", asset_folder_id: 123 });
    expect(wire.authors).toMatchObject({ max_length: 3 });
    expect(wire.items).toMatchObject({ filetypes: ["images"], use_uuid: true });
  });

  it("should drop the inert key option", () => {
    const files = generateProject(LEGACY_SPACE);
    const fields = evaluateFields(files["blocks/article.ts"]);

    for (const field of fields) {
      expect(mapFieldToWire(field).value).not.toHaveProperty("key");
    }
  });
});
