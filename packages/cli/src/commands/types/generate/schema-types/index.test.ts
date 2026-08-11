import { describe, expect, it, vi } from "vitest";
import { vol } from "memfs";

import { assertNoLegacyFlags, generateSchemaTypes } from "./index";

vi.mock("../../../schema/actions", () => ({
  fetchRemoteSchema: vi.fn(async () => ({
    remote: { components: new Map(), componentFolders: new Map(), datasources: new Map() },
    rawComponents: [
      {
        id: 1,
        name: "hero",
        created_at: "",
        updated_at: "",
        is_root: false,
        is_nestable: true,
        schema: { headline: { type: "text", required: true, pos: 0 } },
      },
      {
        id: 2,
        name: "page",
        created_at: "",
        updated_at: "",
        is_root: true,
        is_nestable: false,
        schema: { body: { type: "bloks", pos: 0 } },
      },
    ],
    rawComponentFolders: [],
    rawDatasources: [],
  })),
}));

const written = new Map<string, string>();
vi.mock("../../../../utils/filesystem", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    saveToFile: vi.fn(async (path: string, content: string) => {
      written.set(path, content);
    }),
  };
});

describe("assertNoLegacyFlags", () => {
  it("accepts options that use no legacy-only flag", () => {
    expect(() => assertNoLegacyFlags({ typePrefix: "Sb", separateFiles: true })).not.toThrow();
  });

  it("rejects --strict", () => {
    expect(() => assertNoLegacyFlags({ strict: true })).toThrow(/--strict/);
  });

  it("rejects --suffix", () => {
    expect(() => assertNoLegacyFlags({ suffix: "v1" })).toThrow(/--suffix/);
  });

  it.each([
    ["strict", { strict: true }, /required/],
    ["customFieldsParser", { customFieldsParser: "./p.ts" }, /defineFieldPlugin/],
    ["compilerOptions", { compilerOptions: "./c.json" }, /JSON-schema compiler/],
    ["suffix", { suffix: "v1" }, /pulled component files/],
  ] as const)(
    "explains why %s cannot apply, rather than giving a shared rationale",
    (_name, options, reason) => {
      expect(() => assertNoLegacyFlags(options)).toThrow(reason);
    },
  );

  it("does not explain field optionality to someone who passed only --suffix", () => {
    expect(() => assertNoLegacyFlags({ suffix: "v1" })).not.toThrow(/optionality|required/);
  });

  it("names every offending flag at once", () => {
    expect(() =>
      assertNoLegacyFlags({
        strict: true,
        customFieldsParser: "./p.ts",
        compilerOptions: "./c.json",
        suffix: "v1",
      }),
    ).toThrow(/--strict.*--custom-fields-parser.*--compiler-options.*--suffix/s);
  });

  it("reports rather than rejects a legacy flag the config file set", () => {
    // Erroring here would lock a project whose config sets `strict` out of
    // --future-schema entirely, without the user having typed anything.
    const ignored = assertNoLegacyFlags({ strict: true }, () => "config");

    expect(ignored).toEqual(["--strict"]);
  });

  it("still rejects a legacy flag typed on the command line", () => {
    expect(() => assertNoLegacyFlags({ strict: true }, () => "cli")).toThrow(/--strict/);
  });
});

describe("generateSchemaTypes", () => {
  it("writes a single file containing the shared surface", async () => {
    written.clear();

    const result = await generateSchemaTypes({
      space: "295018",
      cwd: "/project",
      outputDir: "/project/.storyblok/types/295018",
      filename: "storyblok-schema",
    });

    expect(result.files).toEqual(["/project/.storyblok/types/295018/storyblok-schema.d.ts"]);
    const content = written.get("/project/.storyblok/types/295018/storyblok-schema.d.ts")!;
    expect(content).toContain("export type HeroBlockDefinition = {");
    expect(content).toContain("export type PageBlockDefinition = {");
    expect(content).toContain("export type Blocks = HeroBlockDefinition | PageBlockDefinition;");
    expect(content).toContain("export type Block<TName extends Blocks['name']>");
  });

  it("reports custom field types that have no registered plugin", async () => {
    written.clear();
    const { fetchRemoteSchema } = await import("../../../schema/actions");
    vi.mocked(fetchRemoteSchema).mockResolvedValueOnce({
      remote: { components: new Map(), componentFolders: new Map(), datasources: new Map() },
      rawComponents: [
        {
          id: 1,
          name: "hero",
          created_at: "",
          updated_at: "",
          is_root: false,
          is_nestable: true,
          schema: { accent: { type: "custom", field_type: "storyblok-colorpicker", pos: 0 } },
        },
      ],
      rawComponentFolders: [],
      rawDatasources: [],
    } as never);

    const result = await generateSchemaTypes({
      space: "295018",
      cwd: "/project",
      outputDir: "/project/.storyblok/types/295018",
      filename: "storyblok-schema",
    });

    expect(result.unmappedFieldTypes).toEqual(["storyblok-colorpicker"]);
  });

  it("sorts blocks by name so regeneration is byte-stable", async () => {
    written.clear();
    const { fetchRemoteSchema } = await import("../../../schema/actions");
    // Returned in an order MAPI does not promise to keep.
    vi.mocked(fetchRemoteSchema).mockResolvedValueOnce({
      remote: { components: new Map(), componentFolders: new Map(), datasources: new Map() },
      rawComponents: [
        {
          id: 1,
          name: "teaser",
          created_at: "",
          updated_at: "",
          is_root: false,
          is_nestable: true,
          schema: {},
        },
        {
          id: 2,
          name: "hero",
          created_at: "",
          updated_at: "",
          is_root: false,
          is_nestable: true,
          schema: {},
        },
      ],
      rawComponentFolders: [],
      rawDatasources: [],
    } as never);

    await generateSchemaTypes({
      space: "295018",
      cwd: "/project",
      outputDir: "/out",
      filename: "storyblok-schema",
    });

    const content = written.get("/out/storyblok-schema.d.ts")!;
    expect(content).toContain("export type Blocks = HeroBlockDefinition | TeaserBlockDefinition;");
    expect(content.indexOf("HeroBlockDefinition = {")).toBeLessThan(
      content.indexOf("TeaserBlockDefinition = {"),
    );
  });

  it("writes one file per block plus the surface file under --separate-files", async () => {
    written.clear();

    const result = await generateSchemaTypes({
      space: "295018",
      cwd: "/project",
      outputDir: "/out",
      filename: "storyblok-schema",
      separateFiles: true,
    });

    expect(result.files.sort()).toEqual([
      "/out/blocks/hero.d.ts",
      "/out/blocks/page.d.ts",
      "/out/storyblok-schema.d.ts",
    ]);
    expect(written.get("/out/blocks/hero.d.ts")).toContain("export type HeroBlockDefinition = {");
    // The surface file imports the block files rather than redeclaring them.
    const surface = written.get("/out/storyblok-schema.d.ts")!;
    expect(surface).toContain("import type { HeroBlockDefinition } from './blocks/hero.js';");
    expect(surface).toContain("export type Blocks = HeroBlockDefinition | PageBlockDefinition;");
  });

  /**
   * `blocks/` holds one file per component, so a component deleted in the UI
   * would otherwise leave an importable type describing a block that no longer
   * exists. `saveToFile` is mocked here, so only the pre-seeded stale files are
   * on the fake filesystem — enough to assert what pruning removes.
   */
  it("deletes block files for components that no longer exist", async () => {
    written.clear();
    vol.fromJSON({
      "/out/blocks/hero.d.ts": "stale but still a real component",
      "/out/blocks/page.d.ts": "stale but still a real component",
      "/out/blocks/removed-component.d.ts": "orphan",
    });

    const result = await generateSchemaTypes({
      space: "295018",
      cwd: "/project",
      outputDir: "/out",
      filename: "storyblok-schema",
      separateFiles: true,
    });

    expect(result.prunedFiles).toEqual(["/out/blocks/removed-component.d.ts"]);
    expect(Object.keys(vol.toJSON())).not.toContain("/out/blocks/removed-component.d.ts");
    // Files for components that still exist are rewritten, not pruned.
    expect(Object.keys(vol.toJSON())).toEqual(
      expect.arrayContaining(["/out/blocks/hero.d.ts", "/out/blocks/page.d.ts"]),
    );
  });

  it("orphans the whole blocks directory when switching back to single-file output", async () => {
    written.clear();
    vol.fromJSON({
      "/out/blocks/hero.d.ts": "from a previous --separate-files run",
      "/out/blocks/page.d.ts": "from a previous --separate-files run",
    });

    const result = await generateSchemaTypes({
      space: "295018",
      cwd: "/project",
      outputDir: "/out",
      filename: "storyblok-schema",
    });

    expect(result.prunedFiles.sort()).toEqual(["/out/blocks/hero.d.ts", "/out/blocks/page.d.ts"]);
  });

  // The output directory is shared with the legacy generator and may hold files
  // this command knows nothing about, so pruning stops at `blocks/`.
  it("never touches files outside the blocks directory", async () => {
    written.clear();
    vol.fromJSON({
      "/out/storyblok-components.d.ts": "legacy generator output",
      "/out/datasource-types.d.ts": "legacy generator output",
      "/out/blocks/nested/keep.d.ts": "not a file this renderer writes",
    });

    const result = await generateSchemaTypes({
      space: "295018",
      cwd: "/project",
      outputDir: "/out",
      filename: "storyblok-schema",
      separateFiles: true,
    });

    expect(result.prunedFiles).toEqual([]);
    expect(Object.keys(vol.toJSON())).toEqual(
      expect.arrayContaining([
        "/out/storyblok-components.d.ts",
        "/out/datasource-types.d.ts",
        "/out/blocks/nested/keep.d.ts",
      ]),
    );
  });

  it("reports nothing pruned when there is no blocks directory", async () => {
    written.clear();

    const result = await generateSchemaTypes({
      space: "295018",
      cwd: "/project",
      outputDir: "/out",
      filename: "storyblok-schema",
    });

    expect(result.prunedFiles).toEqual([]);
  });

  it("applies --type-prefix and --type-suffix to every exported name", async () => {
    written.clear();

    await generateSchemaTypes({
      space: "295018",
      cwd: "/project",
      outputDir: "/out",
      filename: "storyblok-schema",
      typePrefix: "Sb",
      typeSuffix: "Type",
    });

    const content = written.get("/out/storyblok-schema.d.ts")!;
    expect(content).toContain(
      "export type SbBlocksType = SbHeroBlockDefinitionType | SbPageBlockDefinitionType;",
    );
    expect(content).toContain("export type SbBlockType<TName extends SbBlocksType['name']>");
    expect(content).toContain("export type SbSchemaType = {");
  });

  it("throws when the space has no components", async () => {
    const { fetchRemoteSchema } = await import("../../../schema/actions");
    vi.mocked(fetchRemoteSchema).mockResolvedValueOnce({
      remote: { components: new Map(), componentFolders: new Map(), datasources: new Map() },
      rawComponents: [],
      rawComponentFolders: [],
      rawDatasources: [],
    } as never);

    await expect(
      generateSchemaTypes({
        space: "295018",
        cwd: "/project",
        outputDir: "/out",
        filename: "storyblok-schema",
      }),
    ).rejects.toThrow(/no components/i);
  });
});
