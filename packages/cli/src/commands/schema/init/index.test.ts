import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
import { dirname, join } from "pathe";

import "../index";
import { loadSchemaModule } from "../../../utils/schema/classify-exports";
import { schemaCommand } from "../command";
import { DEFAULT_SPACE, getID } from "../../__tests__/helpers";

vi.spyOn(console, "error");
vi.spyOn(console, "warn");

interface MockComponent {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  schema: Record<string, Record<string, unknown>>;
  is_root?: boolean;
  is_nestable?: boolean;
  internal_tag_ids?: string[];
}

interface MockFolder {
  id: number;
  name: string;
  uuid: string;
}

interface MockDatasource {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

function makeMockComponent(overrides: Partial<MockComponent> = {}): MockComponent {
  const id = getID();
  return {
    id,
    name: `component-${id}`,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    schema: { title: { type: "text", pos: 0 } },
    ...overrides,
  };
}

function makeMockFolder(overrides: Partial<MockFolder> = {}): MockFolder {
  const id = getID();
  return { id, name: `Folder-${id}`, uuid: `uuid-${id}`, ...overrides };
}

function makeMockDatasource(overrides: Partial<MockDatasource> = {}): MockDatasource {
  const id = getID();
  return {
    id,
    name: `DS-${id}`,
    slug: `ds-${id}`,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    ...overrides,
  };
}

const server = setupServer();

const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");

const CLI_NODE_MODULES = join(import.meta.dirname, "../../../../node_modules");

/**
 * Creates a real directory for files that must be loaded from disk. It lives in
 * the CLI's `node_modules`, so generated `@storyblok/schema` imports resolve.
 */
async function makeDiskDir(): Promise<string> {
  return fs.mkdtemp(join(CLI_NODE_MODULES, ".schema-init-test-"));
}

async function initToDisk(): Promise<string> {
  const dir = await makeDiskDir();
  await schemaCommand.parseAsync([
    "node",
    "test",
    "init",
    "--space",
    DEFAULT_SPACE,
    "--out-dir",
    dir,
  ]);
  await copyToDisk(dir);
  return dir;
}

/** Copies the files written to the mocked filesystem under `dir` onto disk. */
async function copyToDisk(dir: string): Promise<void> {
  // memfs strips Windows drive letters from its paths.
  const memfsDir = dir.replace(/^[a-z]:/i, "");
  for (const [path, content] of Object.entries(vol.toJSON())) {
    if (path.startsWith(memfsDir) && typeof content === "string") {
      const diskPath = join(dir, path.slice(memfsDir.length));
      await fs.mkdir(dirname(diskPath), { recursive: true });
      await fs.writeFile(diskPath, content);
    }
  }
}

function warnings(): string {
  return vi
    .mocked(console.warn)
    .mock.calls.map((call) => String(call[0]))
    .join("\n");
}

const preconditions = {
  hasRemoteComponents(components: MockComponent[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ components }),
      ),
    );
  },
  hasRemoteFolders(folders: MockFolder[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/component_groups`, () =>
        HttpResponse.json({ component_groups: folders }),
      ),
    );
  },
  hasRemoteDatasources(datasources: MockDatasource[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/datasources`, () =>
        HttpResponse.json({ datasources }),
      ),
    );
  },
  hasRemoteTags(internalTags: { id: number; name: string }[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/internal_tags`, () =>
        HttpResponse.json({ internal_tags: internalTags }),
      ),
    );
  },
  hasEmptyRemote() {
    this.hasRemoteComponents([]);
    this.hasRemoteFolders([]);
    this.hasRemoteDatasources([]);
    this.hasRemoteTags([]);
  },
  hasRemoteSchema(
    options: {
      components?: MockComponent[];
      folders?: MockFolder[];
      datasources?: MockDatasource[];
      internalTags?: { id: number; name: string }[];
    } = {},
  ) {
    this.hasRemoteComponents(options.components ?? []);
    this.hasRemoteFolders(options.folders ?? []);
    this.hasRemoteDatasources(options.datasources ?? []);
    this.hasRemoteTags(options.internalTags ?? []);
  },
  failsToFetchRemote() {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );
  },
};

describe("schema init command", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
  });

  afterAll(() => server.close());

  it("should generate component files", async () => {
    const comp = makeMockComponent({ name: "hero", is_nestable: true });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    const componentFile = files.find((f) => f.includes("/blocks/hero.ts"));
    expect(componentFile).toBeDefined();

    const content = vol.readFileSync(componentFile!, "utf-8") as string;
    expect(content).toContain("defineBlock(");
    expect(content).toContain("name: 'hero'");
    expect(content).toContain("defineField(");
  });

  it("should mirror component groups as slugified directories and folder refs (no defineBlockFolder files)", async () => {
    const folder = makeMockFolder({ name: "My Layout", uuid: "layout-uuid" });
    const comp = makeMockComponent({ name: "hero", component_group_uuid: "layout-uuid" } as any);
    preconditions.hasRemoteSchema({ components: [comp], folders: [folder] });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    // The block is placed inside its slugified group directory.
    const componentFile = files.find((f) => f.includes("/blocks/my-layout/hero.ts"));
    expect(componentFile).toBeDefined();
    expect(files.some((f) => f.includes("/blocks/folders/"))).toBe(false);

    const content = vol.readFileSync(componentFile!, "utf-8") as string;
    expect(content).toContain("defineBlock(");
    expect(content).not.toContain("defineBlockFolder");
    // Groups aren't part of a content-shape definition, so the field is dropped
    // in favor of an explicit `folder` reference.
    expect(content).not.toContain("component_group_uuid");
    expect(content).toContain("import { myLayoutFolder } from '../../folders';");
    expect(content).toContain("folder: myLayoutFolder,");

    // A root folders.ts is written with a matching defineFolder const.
    const foldersFile = files.find((f) => f.endsWith("/folders.ts"));
    expect(foldersFile).toBeDefined();
    const foldersContent = vol.readFileSync(foldersFile!, "utf-8") as string;
    expect(foldersContent).toContain("import { defineFolder } from '@storyblok/schema';");
    expect(foldersContent).toContain("export const myLayoutFolder = defineFolder({");
    expect(foldersContent).toContain("name: 'My Layout',");

    // schema.ts imports the block from its slugified subdirectory and registers the folder.
    const schemaFile = vol.readFileSync(
      files.find((f) => f.endsWith("/schema.ts"))!,
      "utf-8",
    ) as string;
    expect(schemaFile).toContain("./blocks/my-layout/hero");
    expect(schemaFile).toContain("import { myLayoutFolder } from './folders';");
    expect(schemaFile).toContain("  folders: {");
    expect(schemaFile).toContain("    myLayoutFolder,");
  });

  it("should not write folders.ts or register folders when the space has no groups", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.endsWith("/folders.ts"))).toBe(false);

    const schemaFile = vol.readFileSync(
      files.find((f) => f.endsWith("/schema.ts"))!,
      "utf-8",
    ) as string;
    expect(schemaFile).not.toContain("folders:");
    expect(schemaFile).not.toContain("./folders");
  });

  it("should emit block tags by name instead of space-local ids", async () => {
    const comp = makeMockComponent({ name: "hero", internal_tag_ids: ["555"] });
    preconditions.hasRemoteSchema({
      components: [comp],
      internalTags: [{ id: 555, name: "Marketing" }],
    });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = vol.toJSON();
    const content = files[Object.keys(files).find((f) => f.includes("/blocks/hero.ts"))!];
    expect(content).toContain("tags: [");
    expect(content).toContain("'Marketing'");
    expect(content).not.toContain("internal_tag_ids");
  });

  it("should emit a field's tag restriction as named tag refs", async () => {
    const comp = makeMockComponent({
      name: "hero",
      schema: {
        body: {
          type: "bloks",
          pos: 0,
          restrict_components: true,
          restrict_type: "tags",
          component_tag_whitelist: [555],
        },
      },
    });
    preconditions.hasRemoteSchema({
      components: [comp],
      internalTags: [{ id: 555, name: "Marketing" }],
    });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = vol.toJSON();
    const content = files[Object.keys(files).find((f) => f.includes("/blocks/hero.ts"))!];
    expect(content).toContain("allow: [");
    expect(content).toContain("tag: 'Marketing'");
    expect(content).not.toContain("component_tag_whitelist");
  });

  it("should keep a tag id the space cannot name as the raw wire form", async () => {
    const comp = makeMockComponent({ name: "hero", internal_tag_ids: ["999"] });
    preconditions.hasRemoteSchema({
      components: [comp],
      internalTags: [{ id: 555, name: "Marketing" }],
    });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = vol.toJSON();
    const content = files[Object.keys(files).find((f) => f.includes("/blocks/hero.ts"))!];
    expect(content).toContain("internal_tag_ids");
    expect(content).not.toContain("tags: [");
  });

  it("should generate datasource files", async () => {
    const ds = makeMockDatasource({ name: "Categories", slug: "categories" });
    preconditions.hasRemoteSchema({ datasources: [ds] });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    const dsFile = files.find((f) => f.includes("/datasources/categories.ts"));
    expect(dsFile).toBeDefined();

    const content = vol.readFileSync(dsFile!, "utf-8") as string;
    expect(content).toContain("defineDatasource(");
    expect(content).toContain("name: 'Categories'");
    expect(content).toContain("slug: 'categories'");
  });

  it("generates valid identifiers for datasource names containing special characters", async () => {
    const ds = makeMockDatasource({ name: "Colors & Sizes", slug: "colors-sizes" });
    preconditions.hasRemoteSchema({ datasources: [ds] });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());

    // Datasource file name is shell-safe.
    const dsFile = files.find((f) => f.includes("/datasources/colors-sizes.ts"));
    expect(dsFile).toBeDefined();
    const dsContent = vol.readFileSync(dsFile!, "utf-8") as string;
    expect(dsContent).toContain("export const colorsSizesDatasource = defineDatasource({");

    // schema.ts import, export reference, and key all agree and contain no `&`.
    const schemaFile = files.find((f) => f.endsWith("/schema.ts"));
    expect(schemaFile).toBeDefined();
    const schemaContent = vol.readFileSync(schemaFile!, "utf-8") as string;
    expect(schemaContent).toContain(
      "import { colorsSizesDatasource } from './datasources/colors-sizes';",
    );
    expect(schemaContent).toContain("    colorsSizesDatasource,");
    expect(schemaContent).not.toContain("&");
  });

  it("writes distinct files when component names collapse to the same kebab-case file name", async () => {
    // `hero_cta` and `hero-cta` are distinct component names that both kebab to
    // `hero-cta`. Without dedup the second file would overwrite the first while
    // schema.ts still imports two symbols from the one path (uncompilable TS).
    const comps = [
      makeMockComponent({ name: "hero_cta" }),
      makeMockComponent({ name: "hero-cta" }),
    ];
    preconditions.hasRemoteSchema({ components: comps });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    // Both blocks land in their own file — no overwrite.
    expect(files.some((f) => f.endsWith("/blocks/hero-cta.ts"))).toBe(true);
    expect(files.some((f) => f.endsWith("/blocks/hero-cta-2.ts"))).toBe(true);

    // schema.ts imports each block from a distinct existing path.
    const schemaContent = vol.readFileSync(
      files.find((f) => f.endsWith("/schema.ts"))!,
      "utf-8",
    ) as string;
    expect(schemaContent).toContain("from './blocks/hero-cta';");
    expect(schemaContent).toContain("from './blocks/hero-cta-2';");
  });

  it("keeps a shared file name for colliding blocks in different group directories", async () => {
    // `hero_cta` and `hero-cta` both kebab to `hero-cta`, but they live in
    // different group directories — they don't collide on disk, so each keeps
    // the shared file name and its import carries the distinguishing subpath.
    const folderA = makeMockFolder({ name: "Group A", uuid: "group-a-uuid" });
    const folderB = makeMockFolder({ name: "Group B", uuid: "group-b-uuid" });
    const comps = [
      makeMockComponent({ name: "hero_cta", component_group_uuid: "group-a-uuid" } as any),
      makeMockComponent({ name: "hero-cta", component_group_uuid: "group-b-uuid" } as any),
    ];
    preconditions.hasRemoteSchema({ components: comps, folders: [folderA, folderB] });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.endsWith("/blocks/group-a/hero-cta.ts"))).toBe(true);
    expect(files.some((f) => f.endsWith("/blocks/group-b/hero-cta.ts"))).toBe(true);

    const schemaContent = vol.readFileSync(
      files.find((f) => f.endsWith("/schema.ts"))!,
      "utf-8",
    ) as string;
    expect(schemaContent).toContain("from './blocks/group-a/hero-cta';");
    expect(schemaContent).toContain("from './blocks/group-b/hero-cta';");
  });

  it("should generate schema.ts with schema object and types", async () => {
    const comp = makeMockComponent({ name: "page", is_root: true });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());

    const schemaFile = files.find((f) => f.endsWith("/schema.ts"));
    expect(schemaFile).toBeDefined();
    const schemaContent = vol.readFileSync(schemaFile!, "utf-8") as string;
    expect(schemaContent).toContain("export const schema = defineSchema({");
    expect(schemaContent).toContain("pageBlock,");
    expect(schemaContent).toContain("InferSchema<typeof schema>");
    expect(schemaContent).toContain("export type Story = InferStory");
  });

  it("should write to .storyblok/schema by default", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.includes(".storyblok/schema/blocks/hero.ts"))).toBe(true);
    expect(files.some((f) => f.includes(".storyblok/schema/schema.ts"))).toBe(true);
  });

  it("should respect --out-dir option", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync([
      "node",
      "test",
      "init",
      "--space",
      DEFAULT_SPACE,
      "--out-dir",
      "./custom/output",
    ]);

    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.includes("custom/output/blocks/hero.ts"))).toBe(true);
    expect(files.some((f) => f.includes("custom/output/schema.ts"))).toBe(true);
  });

  it("should handle API errors gracefully", async () => {
    preconditions.failsToFetchRemote();

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    // Should not throw — error is handled
  });

  it("should handle empty remote space", async () => {
    preconditions.hasEmptyRemote();

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    // Should still generate schema.ts even with no entities
    expect(files.some((f) => f.endsWith("/schema.ts"))).toBe(true);
  });

  it("should confirm success and print next steps", async () => {
    preconditions.hasEmptyRemote();

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Success"));
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Schema workspace initialized"),
    );
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Next steps:"));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("source of truth"));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("schema push"));
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should strip API-only fields but preserve user-settable fields in generated code", async () => {
    const comp = makeMockComponent({
      name: "hero",
      schema: {
        title: { type: "text", pos: 0, id: "api-field-id" },
      },
    });
    (comp as any).internal_tag_ids = [10, 20];
    (comp as any).metadata = { some: "data" };

    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    const componentFile = files.find((f) => f.includes("/blocks/hero.ts"));
    expect(componentFile).toBeDefined();

    const content = vol.readFileSync(componentFile!, "utf-8") as string;
    // internal_tag_ids is user-settable (in ComponentCreate/Update), so it's preserved
    expect(content).toContain("internal_tag_ids");
    expect(content).toContain("metadata");
    expect(content).not.toContain("api-field-id");
  });

  it("should list generated files as paths relative to the current working directory", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    expect(console.error).toHaveBeenCalledWith("  .storyblok/schema/blocks/hero.ts");
    expect(console.error).toHaveBeenCalledWith("  .storyblok/schema/schema.ts");
  });

  it("should refuse when the target directory is not empty", async () => {
    vol.fromJSON({
      ".storyblok/schema/blocks/existing.ts": "// existing",
    });
    let unhandledRequest = false;
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () => {
        unhandledRequest = true;
        return HttpResponse.json({ components: [] });
      }),
    );

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    expect(unhandledRequest).toBe(false);
    const schemaFiles = Object.keys(vol.toJSON()).filter((f) => f.includes(".storyblok/schema/"));
    expect(schemaFiles).toEqual(expect.arrayContaining([expect.stringContaining("existing.ts")]));
    expect(schemaFiles.some((f) => f.includes("schema.ts"))).toBe(false);
  });

  it("should treat a directory containing only hidden files as empty", async () => {
    vol.fromJSON({
      ".storyblok/schema/.gitkeep": "",
      ".storyblok/schema/.DS_Store": "",
    });
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasRemoteSchema({ components: [comp] });

    await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.includes(".storyblok/schema/blocks/hero.ts"))).toBe(true);
  });

  describe("custom field plugins", () => {
    let diskDir: string | undefined;

    afterEach(async () => {
      if (diskDir) {
        await fs.rm(diskDir, { recursive: true, force: true });
        diskDir = undefined;
      }
      process.exitCode = undefined;
    });

    it("should register every custom field plugin so the initialized schema validates", async () => {
      const comp = makeMockComponent({
        name: "page",
        is_root: true,
        schema: {
          color: { type: "custom", field_type: "my-color-picker", pos: 0 },
          map: { type: "custom", field_type: "acme_map", pos: 1 },
          accent: { type: "custom", field_type: "storyblok-colorpicker", pos: 2 },
          icon: { type: "custom", field_type: "@acme/icon-picker", pos: 3 },
          mapAlias: { type: "custom", field_type: "acme-map", pos: 4 },
        },
      });
      preconditions.hasRemoteSchema({ components: [comp] });
      diskDir = await initToDisk();

      await schemaCommand.parseAsync(["node", "test", "validate", join(diskDir, "schema.ts")]);

      expect(process.exitCode).toBe(0);
      const output = vi
        .mocked(console.error)
        .mock.calls.map((call) => String(call[0]))
        .join("\n");
      expect(output).toContain("0 errors, 0 warnings");
    });

    it("should warn that generated field plugins need their value shapes defined", async () => {
      const comp = makeMockComponent({
        name: "page",
        schema: {
          color: { type: "custom", field_type: "my-color-picker", pos: 0 },
          map: { type: "custom", field_type: "acme_map", pos: 1 },
        },
      });
      preconditions.hasRemoteSchema({ components: [comp] });

      await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

      expect(warnings()).toContain("placeholder field plugins");
      expect(warnings()).toContain("acme_map (.storyblok/schema/field-plugins/acme-map.ts)");
      expect(warnings()).toContain(
        "my-color-picker (.storyblok/schema/field-plugins/my-color-picker.ts)",
      );
    });

    it("should use the official definition instead of a placeholder for an official field plugin", async () => {
      const comp = makeMockComponent({
        name: "page",
        schema: { accent: { type: "custom", field_type: "storyblok-colorpicker", pos: 0 } },
      });
      preconditions.hasRemoteSchema({ components: [comp] });
      diskDir = await initToDisk();

      const { schema } = await loadSchemaModule(join(diskDir, "schema.ts"));
      expect(schema).toMatchObject({
        fieldPlugins: {
          storyblokColorField: expect.objectContaining({ fieldType: "storyblok-colorpicker" }),
        },
      });
      expect(Object.keys(vol.toJSON()).some((f) => f.includes("/field-plugins/"))).toBe(false);
      expect(warnings()).not.toContain("placeholder field plugins");
    });

    it("should name colliding placeholder files the same way regardless of the system locale", async () => {
      const comp = makeMockComponent({
        name: "page",
        schema: {
          lower: { type: "custom", field_type: "acme", pos: 0 },
          upper: { type: "custom", field_type: "Acme", pos: 1 },
        },
      });
      preconditions.hasRemoteSchema({ components: [comp] });

      await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

      expect(warnings()).toContain("Acme (.storyblok/schema/field-plugins/acme.ts)");
      expect(warnings()).toContain("acme (.storyblok/schema/field-plugins/acme-2.ts)");
    });

    it("should skip and report custom fields that name no field plugin", async () => {
      const comp = makeMockComponent({
        name: "page",
        schema: {
          empty: { type: "custom", field_type: "", pos: 0 },
          missing: { type: "custom", pos: 1 },
        },
      });
      preconditions.hasRemoteSchema({ components: [comp] });

      await schemaCommand.parseAsync(["node", "test", "init", "--space", DEFAULT_SPACE]);

      expect(warnings()).toContain("Skipped custom fields that name no field plugin");
      expect(warnings()).toContain("page.empty");
      expect(warnings()).toContain("page.missing");
      expect(Object.keys(vol.toJSON()).some((f) => f.includes("/field-plugins/"))).toBe(false);
    });

    it("should not warn when the space uses no custom field plugins", async () => {
      const comp = makeMockComponent({ name: "page" });
      preconditions.hasRemoteSchema({ components: [comp] });
      diskDir = await initToDisk();

      const { schema } = await loadSchemaModule(join(diskDir, "schema.ts"));
      expect(schema).not.toHaveProperty("fieldPlugins");
      expect(warnings()).not.toContain("placeholder field plugins");
    });
  });
});
