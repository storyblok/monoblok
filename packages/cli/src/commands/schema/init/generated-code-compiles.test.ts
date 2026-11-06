import { fileURLToPath } from "node:url";
import { dirname, join } from "pathe";
import ts from "typescript";
import { describe, expect, it } from "vitest";

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

/** Runs a generated block file with a pass-through `defineField`, returning its fields. */
function evaluateFields(code: string): Record<string, unknown>[] {
  const { outputText } = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const exports: Record<string, { fields: Record<string, unknown>[] }> = {};
  const schemaModule = {
    defineBlock: (block: unknown) => block,
    defineField: (name: string, field: object) => ({ name, ...field }),
  };
  new Function("require", "exports", outputText)(() => schemaModule, exports);
  return Object.values(exports)[0].fields;
}

const component = (name: string, schema: Record<string, Record<string, unknown>>): Component =>
  ({ id: 1, name, created_at: "", updated_at: "", schema }) as unknown as Component;

/**
 * A space's fields as the Management API returns them after years of editing:
 * options left behind by a field type change, numbers and booleans stored as
 * strings, a tag list beside a name restriction, and toolbar items a richtext
 * field can hold.
 */
const LEGACY_SPACE: Component[] = [
  component("article", {
    title: {
      type: "text",
      pos: 0,
      key: "title",
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

  it("should still reject an unknown option written by hand", () => {
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

  it("should push a tag denylist beside a block name restriction back unchanged", () => {
    const files = generateProject(LEGACY_SPACE);
    const fields = evaluateFields(files["blocks/listing.ts"]);
    const text = fields.find((field) => field.name === "text");

    expect(mapFieldToWire(text ?? {}).value).toMatchObject({
      component_whitelist: ["card"],
      component_tag_denylist: [2],
      restrict_components: true,
      restrict_type: "",
    });
  });

  it("should push numbers and booleans stored as strings in the type the field wants", () => {
    const files = generateProject(LEGACY_SPACE);
    const listing = evaluateFields(files["blocks/listing.ts"]);
    const article = evaluateFields(files["blocks/article.ts"]);

    expect(listing.find((field) => field.name === "items")).toMatchObject({ maximum: 2 });
    expect(listing.find((field) => field.name === "items")).not.toHaveProperty("minimum");
    expect(article.find((field) => field.name === "featured")).toMatchObject({
      default_value: true,
    });
    expect(article.find((field) => field.name === "noindex")).not.toHaveProperty("default_value");
  });

  it("should drop options left behind by a field type change", () => {
    const files = generateProject(LEGACY_SPACE);
    const fields = [
      ...evaluateFields(files["blocks/article.ts"]),
      ...evaluateFields(files["blocks/listing.ts"]),
    ];
    const wire = Object.fromEntries(
      fields.map((field) => [field.name, mapFieldToWire(field).value]),
    );

    expect(wire.title).toEqual({ type: "text" });
    expect(wire.noindex).toEqual({ type: "boolean" });
    expect(wire.cover).toEqual({ type: "asset", filetypes: ["images"] });
    expect(wire.decoration).not.toHaveProperty("filetypes");
    expect(wire.authors).toEqual({
      type: "options",
      source: "internal_stories",
      max_options: 4,
      min_options: "1",
    });
    expect(wire.items).toEqual({
      type: "bloks",
      component_whitelist: ["card"],
      restrict_components: true,
      restrict_type: "",
      maximum: 2,
    });
  });
});
