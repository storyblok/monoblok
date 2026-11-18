import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
import { confirm } from "@inquirer/prompts";

import "../index";
import "../../migrations/index";
import { schemaCommand } from "../command";
import { migrationsCommand } from "../../migrations/command";
import type { SchemaData } from "../types";
import { DEFAULT_SPACE, getID } from "../../__tests__/helpers";

import { loadSchema } from "../load-schema";
import { delay } from "../../../utils/fetch";
import { RENAME_TIMEOUT_MS } from "./block-renames";

// loadSchema uses jiti to dynamically import TypeScript entry files at runtime.
// jiti cannot resolve @storyblok/schema imports in the test environment, so we
// mock this module and provide schema data directly via preconditions.
vi.mock("../load-schema", () => ({
  loadSchema: vi.fn(),
}));

// Waiting for the space to rename a block in its stories polls with `delay`,
// which here moves the faked clock instead of waiting.
vi.mock("../../../utils/fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/fetch")>()),
  delay: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
  select: vi.fn(),
}));

vi.spyOn(console, "warn");
vi.spyOn(console, "error");

interface MockComponent {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  schema: Record<string, Record<string, unknown>>;
  is_root?: boolean;
  is_nestable?: boolean;
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

const preconditions = {
  hasLocalSchema(
    schema: Pick<SchemaData, "components" | "datasources"> & Partial<Pick<SchemaData, "folders">>,
  ) {
    vi.mocked(loadSchema).mockResolvedValue({ folders: [], ...schema });
  },
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
  canCreateComponents(components: MockComponent[]) {
    const created = components.map((c) => ({ ...c, id: getID() }));
    server.use(
      http.post(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`,
        async ({ request }) => {
          const body = (await request.json()) as { component: { name: string } };
          const match = created.find((c) => c.name === body.component.name);
          return HttpResponse.json({ component: match ?? created[0] });
        },
      ),
    );
    return created;
  },
  failsToUpdateComponents() {
    server.use(
      http.put(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components/:id`, () =>
        HttpResponse.json({ error: "Server error" }, { status: 500 }),
      ),
    );
  },
  /** Updates `updated` and rejects every other component, as a partially failing push does. */
  updatesOnlyComponent(updated: MockComponent, remote: MockComponent[]) {
    let components = remote;
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ components }),
      ),
      http.put(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components/:id`,
        ({ params }) => {
          if (Number(params.id) !== updated.id) {
            return HttpResponse.json({ error: "Unprocessable" }, { status: 422 });
          }
          components = components.map((c) => (c.id === updated.id ? updated : c));
          return HttpResponse.json({ component: updated });
        },
      ),
    );
  },
  canUpdateComponents() {
    server.use(
      http.put(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components/:id`,
        async ({ request }) => {
          const body = (await request.json()) as { component: MockComponent };
          return HttpResponse.json({ component: body.component });
        },
      ),
    );
  },
  canDeleteComponents() {
    server.use(
      http.delete(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components/:id`, () =>
        HttpResponse.json({}),
      ),
    );
  },
  canCreateDatasources(datasources: MockDatasource[]) {
    const created = datasources.map((d) => ({ ...d, id: getID() }));
    server.use(
      http.post(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/datasources`,
        async ({ request }) => {
          const body = (await request.json()) as { datasource: { name: string } };
          const match = created.find((d) => d.name === body.datasource.name);
          return HttpResponse.json({ datasource: match ?? created[0] });
        },
      ),
    );
    return created;
  },
  canDeleteDatasources() {
    server.use(
      http.delete(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/datasources/:id`, () =>
        HttpResponse.json({}),
      ),
    );
  },
  failsToFetchRemote() {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );
  },
  async hasDuplicateBlockNamesInEntryFile() {
    // Runs the real classifier so the aborting error is the production one; it
    // never touches jiti, only the already-loaded module exports below.
    const { classifyExports } =
      await vi.importActual<typeof import("../load-schema")>("../load-schema");
    vi.mocked(loadSchema).mockImplementation(async () =>
      classifyExports({
        a: { name: "hero", fields: [{ name: "headline", type: "text" }] },
        b: { name: "hero", fields: [{ name: "subline", type: "text" }] },
      }),
    );
  },
  /**
   * Stories by the blocks they contain, and story folders. A folder restricts
   * content types through `default_root` and `content.content_types`.
   */
  hasStories(
    usage: Record<string, number>,
    folders: {
      id: number;
      full_slug: string;
      default_root?: string;
      content_types?: string[];
    }[] = [],
  ) {
    const folderUpdates: { id: number; story: Record<string, unknown> }[] = [];
    const storyFolder = (folder: (typeof folders)[number]) => ({
      id: folder.id,
      name: folder.full_slug,
      slug: folder.full_slug,
      full_slug: folder.full_slug,
      is_folder: true,
      default_root: folder.default_root,
      content: { content_types: folder.content_types ?? [], lock_subfolders_content_types: false },
    });
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.get("folder_only") === "true") {
          return HttpResponse.json(
            { stories: folders.map(({ id, full_slug }) => ({ id, full_slug, is_folder: true })) },
            { headers: { Total: String(folders.length), "Per-Page": "100" } },
          );
        }
        const total = usage[params.get("contain_component") ?? ""] ?? 0;
        return HttpResponse.json({ stories: [] }, { headers: { Total: String(total) } });
      }),
      http.get(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/:id`,
        ({ params }) => {
          const folder = folders.find((candidate) => candidate.id === Number(params.id));
          return folder
            ? HttpResponse.json({ story: storyFolder(folder) })
            : HttpResponse.json({ error: "Not Found" }, { status: 404 });
        },
      ),
      http.put(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/:id`,
        async ({ request, params }) => {
          const body = (await request.json()) as { story: Record<string, unknown> };
          folderUpdates.push({ id: Number(params.id), story: body.story });
          return HttpResponse.json({ story: { id: Number(params.id), ...body.story } });
        },
      ),
    );
    return folderUpdates;
  },
  failsToCountStories(status: number) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, () =>
        HttpResponse.json({ error: "Stories unavailable" }, { status }),
      ),
    );
  },
  confirmsMigrations() {
    vi.mocked(confirm).mockResolvedValue(true);
  },
  declinesPrompt() {
    vi.mocked(confirm).mockResolvedValue(false);
  },
};

function writtenFile(suffix: string): string | undefined {
  return Object.entries(vol.toJSON()).find(([file]) => file.endsWith(suffix))?.[1] ?? undefined;
}

/** The text of each run of line comments in `source`, wrapped lines joined. */
function commentsIn(source: string | undefined): string[] {
  const blocks = (source ?? "").split(/\n(?!\s*\/\/)/);
  return blocks.flatMap((block) => {
    const lines = [...block.matchAll(/^\s*\/\/ (.*)$/gm)].map((match) => match[1]);
    return lines.length > 0 ? [lines.join(" ")] : [];
  });
}

function migrationFiles(): string[] {
  return Object.keys(vol.toJSON())
    .filter((file) => file.includes(`migrations/${DEFAULT_SPACE}/`))
    .sort();
}

describe("schema push command", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T09:05:03Z"));
    vi.mocked(delay).mockImplementation(async (ms) => {
      vi.setSystemTime(Date.now() + ms);
    });
    preconditions.hasStories({});
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
    const pushCmd = schemaCommand.commands.find((command) => command.name() === "push");
    pushCmd?.setOptionValueWithSource("legacy", undefined, "default");
    pushCmd?.setOptionValueWithSource("before", true, "default");
    pushCmd?.setOptionValueWithSource("path", undefined, "default");
    pushCmd?.setOptionValueWithSource("force", false, "default");
    vi.useRealTimers();
  });

  afterAll(() => server.close());

  it("should show diff and stop in dry-run mode", async () => {
    const localComp = makeMockComponent({ name: "hero" });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasEmptyRemote();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--dry-run",
    ]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
    // msw is configured with onUnhandledRequest: 'error' and no POST/PUT/DELETE
    // handlers are registered, so any mutation attempt would fail the test.
  });

  it("should create new components when remote is empty", async () => {
    const localComp = makeMockComponent({ name: "hero" });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasEmptyRemote();
    preconditions.canCreateComponents([localComp]);

    await schemaCommand.parseAsync(["node", "test", "push", "schema.ts", "--space", DEFAULT_SPACE]);

    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.includes("schema/changesets/"))).toBe(true);
    // Default: writes per-component local files so stories push can validate without a separate `components pull`.
    expect(files.some((f) => f.endsWith(`/components/${DEFAULT_SPACE}/hero.json`))).toBe(true);
  });

  it("should confirm the push after the advisory warnings", async () => {
    const localComp = makeMockComponent({ name: "hero" });
    const staleComp = makeMockComponent({ name: "footer" });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([staleComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canCreateComponents([localComp]);

    await schemaCommand.parseAsync(["node", "test", "push", "schema.ts", "--space", DEFAULT_SPACE]);

    const { calls, invocationCallOrder } = vi.mocked(console.error).mock;
    const confirmation = calls.findIndex(([message]) =>
      String(message).includes(`Schema pushed to space ${DEFAULT_SPACE}`),
    );
    const warnings = vi.mocked(console.warn).mock.invocationCallOrder;

    expect(warnings.length).toBeGreaterThan(0);
    expect(String(calls[confirmation]?.[0])).toContain("1 created");
    // The confirmation is the last thing the user sees, so a run that only
    // surfaced advisory warnings does not read as a failure.
    expect(invocationCallOrder[confirmation]).toBeGreaterThan(Math.max(...warnings));
  });

  it("should skip writing local component files when --no-write-components is used", async () => {
    const localComp = makeMockComponent({ name: "hero" });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasEmptyRemote();
    preconditions.canCreateComponents([localComp]);

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--no-write-components",
    ]);

    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.endsWith(`/components/${DEFAULT_SPACE}/hero.json`))).toBe(false);
  });

  it("should not remove local stale files when --delete is combined with --no-write-components", async () => {
    const localComp = makeMockComponent({
      name: "hero",
      schema: { title: { type: "text", pos: 0 } },
    });
    const staleComp = makeMockComponent({ name: "footer" });
    // Pre-seed a local file for the stale component to verify it survives.
    vol.fromJSON({
      [`.storyblok/components/${DEFAULT_SPACE}/footer.json`]: JSON.stringify({
        name: "footer",
        schema: {},
      }),
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([localComp, staleComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canDeleteComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--delete",
      "--no-write-components",
    ]);

    const files = Object.keys(vol.toJSON());
    // Local stale file is preserved — the opt-out covers writes AND deletes.
    expect(files.some((f) => f.endsWith(`/components/${DEFAULT_SPACE}/footer.json`))).toBe(true);
    // And no new files are written either.
    expect(files.some((f) => f.endsWith(`/components/${DEFAULT_SPACE}/hero.json`))).toBe(false);
  });

  it("should not write local component files in --dry-run mode", async () => {
    const localComp = makeMockComponent({ name: "hero" });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasEmptyRemote();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--dry-run",
    ]);

    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.endsWith(`/components/${DEFAULT_SPACE}/hero.json`))).toBe(false);
  });

  it("should detect unchanged components and skip push", async () => {
    const comp = makeMockComponent({ name: "hero", schema: { title: { type: "text", pos: 0 } } });
    preconditions.hasLocalSchema({
      components: [comp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([comp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);

    await schemaCommand.parseAsync(["node", "test", "push", "schema.ts", "--space", DEFAULT_SPACE]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("nothing to push"));
    // Local files are still written so a fresh checkout can run `stories push`
    // even when the remote space is already in sync with the schema.
    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.endsWith(`/components/${DEFAULT_SPACE}/hero.json`))).toBe(true);
  });

  it("should show stale warning without --delete", async () => {
    const localComp = makeMockComponent({
      name: "hero",
      schema: { title: { type: "text", pos: 0 } },
    });
    const staleComp = makeMockComponent({ name: "footer" });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([localComp, staleComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);

    await schemaCommand.parseAsync(["node", "test", "push", "schema.ts", "--space", DEFAULT_SPACE]);

    // Stale entities appear in the diff output
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("stale"));
    // msw is configured with onUnhandledRequest: 'error' and no DELETE handlers
    // are registered, so any delete attempt would fail the test.
  });

  it("should delete stale entities with --delete", async () => {
    const localComp = makeMockComponent({
      name: "hero",
      schema: { title: { type: "text", pos: 0 } },
    });
    const staleComp = makeMockComponent({ name: "footer" });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([localComp, staleComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canDeleteComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--delete",
    ]);

    // Verify changeset only contains delete entries when --delete is set
    const changesetFile = Object.entries(vol.toJSON()).find(([filename]) =>
      filename.includes("schema/changesets/"),
    )?.[1];
    const changeset = JSON.parse(changesetFile ?? "{}");
    expect(changeset.changes.some((c: { action: string }) => c.action === "delete")).toBe(true);
  });

  it("should push components flat, neither setting nor clearing component groups", async () => {
    const comp = makeMockComponent({ name: "hero" });
    const ds = makeMockDatasource({ name: "Colors", slug: "colors" });

    preconditions.hasLocalSchema({
      components: [comp] as any,
      datasources: [ds] as any,
    });
    preconditions.hasEmptyRemote();
    preconditions.canCreateDatasources([ds]);

    let componentBody: { name: string; component_group_uuid?: string } | undefined;
    server.use(
      http.post(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`,
        async ({ request }) => {
          componentBody = ((await request.json()) as { component: typeof componentBody }).component;
          return HttpResponse.json({ component: { ...comp, id: getID() } });
        },
      ),
    );
    // No component_groups POST handler is registered, and msw errors on
    // unhandled requests — so any attempt to create a group would fail the test.

    await schemaCommand.parseAsync(["node", "test", "push", "schema.ts", "--space", DEFAULT_SPACE]);

    expect(componentBody?.name).toBe("hero");
    expect(componentBody?.component_group_uuid).toBeUndefined();
  });

  describe("optional block properties", () => {
    const optionalProperties = {
      image: "https://a.storyblok.com/f/12345/hero.png",
      preview_tmpl: "<div>{{ it.title }}</div>",
      content_type_asset_preview: "title",
    };

    it("should send the optional properties a block sets", async () => {
      const comp = {
        ...makeMockComponent({ name: "hero" }),
        ...optionalProperties,
        metadata: [{ app_slug: "figma_to_storyblok", frame_id: "1:2" }],
      };
      preconditions.hasLocalSchema({ components: [comp] as any, datasources: [] });
      preconditions.hasEmptyRemote();
      let componentBody: unknown;
      server.use(
        http.post(
          `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`,
          async ({ request }) => {
            componentBody = ((await request.json()) as { component: unknown }).component;
            return HttpResponse.json({ component: { ...comp, id: getID() } });
          },
        ),
      );

      await schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
      ]);

      expect(componentBody).toMatchObject(optionalProperties);
      expect(componentBody).not.toHaveProperty("metadata");
    });

    it("should leave optional properties a block omits untouched", async () => {
      const comp = makeMockComponent({ name: "hero" });
      preconditions.hasLocalSchema({ components: [comp] as any, datasources: [] });
      preconditions.hasRemoteComponents([{ ...comp, ...optionalProperties }]);
      preconditions.hasRemoteFolders([]);
      preconditions.hasRemoteDatasources([]);
      preconditions.hasRemoteTags([]);

      await schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
      ]);

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("nothing to push"));
    });

    it("should leave app-owned metadata untouched even when a block sets it", async () => {
      const comp = makeMockComponent({ name: "hero" });
      preconditions.hasLocalSchema({
        components: [{ ...comp, metadata: [{ app_slug: "local", frame_id: "9:9" }] }] as any,
        datasources: [],
      });
      const linkedToFigma = {
        ...comp,
        metadata: [{ app_slug: "figma_to_storyblok", frame_id: "1:2" }],
      };
      preconditions.hasRemoteComponents([linkedToFigma]);
      preconditions.hasRemoteFolders([]);
      preconditions.hasRemoteDatasources([]);
      preconditions.hasRemoteTags([]);

      await schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
      ]);

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("nothing to push"));
    });

    it("should clear optional properties a block sets to null", async () => {
      const comp = makeMockComponent({ name: "hero" });
      preconditions.hasLocalSchema({
        components: [{ ...comp, image: null }] as any,
        datasources: [],
      });
      preconditions.hasRemoteComponents([{ ...comp, ...optionalProperties }]);
      preconditions.hasRemoteFolders([]);
      preconditions.hasRemoteDatasources([]);
      preconditions.hasRemoteTags([]);
      let componentBody: unknown;
      server.use(
        http.put(
          `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components/:id`,
          async ({ request }) => {
            componentBody = ((await request.json()) as { component: unknown }).component;
            return HttpResponse.json({ component: comp });
          },
        ),
      );

      await schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
      ]);

      expect(componentBody).toMatchObject({ image: null });
      expect(componentBody).not.toHaveProperty("preview_tmpl");
    });

    it("should report nothing to push once optional properties a block sets to null are cleared", async () => {
      const comp = makeMockComponent({ name: "hero" });
      preconditions.hasLocalSchema({
        components: [{ ...comp, image: null }] as any,
        datasources: [],
      });
      const cleared = { image: null };
      preconditions.hasRemoteComponents([{ ...comp, ...cleared }]);
      preconditions.hasRemoteFolders([]);
      preconditions.hasRemoteDatasources([]);
      preconditions.hasRemoteTags([]);

      await schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
      ]);

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("nothing to push"));
    });
  });

  describe("block tags", () => {
    function capturesComponentCreate(comp: MockComponent) {
      const bodies: { name: string; internal_tag_ids?: number[]; schema?: any }[] = [];
      server.use(
        http.post(
          `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`,
          async ({ request }) => {
            const body = (await request.json()) as { component: (typeof bodies)[number] };
            bodies.push(body.component);
            return HttpResponse.json({ component: { ...comp, id: getID() } });
          },
        ),
      );
      return bodies;
    }

    it("should send the target space's id for a tag the space already has", async () => {
      const comp = makeMockComponent({ name: "hero" });
      preconditions.hasLocalSchema({
        components: [{ ...comp, tags: ["Marketing"] }] as any,
        datasources: [],
      });
      preconditions.hasRemoteComponents([]);
      preconditions.hasRemoteFolders([]);
      preconditions.hasRemoteDatasources([]);
      preconditions.hasRemoteTags([{ id: 555, name: "Marketing" }]);
      const bodies = capturesComponentCreate(comp);

      await schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
      ]);

      expect(bodies[0]?.internal_tag_ids).toEqual([555]);
    });

    it("should create a tag the target space does not have and use its id", async () => {
      const comp = makeMockComponent({ name: "hero" });
      preconditions.hasLocalSchema({
        components: [{ ...comp, tags: ["Marketing"] }] as any,
        datasources: [],
      });
      preconditions.hasEmptyRemote();
      const created: { name: string; object_type: string }[] = [];
      server.use(
        http.post(
          `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/internal_tags`,
          async ({ request }) => {
            const body = (await request.json()) as { internal_tag: (typeof created)[number] };
            created.push(body.internal_tag);
            return HttpResponse.json({ internal_tag: { id: 777, ...body.internal_tag } });
          },
        ),
      );
      const bodies = capturesComponentCreate(comp);

      await schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
      ]);

      expect(created).toEqual([{ name: "Marketing", object_type: "component" }]);
      expect(bodies[0]?.internal_tag_ids).toEqual([777]);
    });

    it("should resolve a field's tag restriction to target space ids", async () => {
      const comp = makeMockComponent({
        name: "hero",
        schema: {
          body: {
            type: "bloks",
            restrict_components: true,
            restrict_type: "tags",
            component_tag_whitelist: ["Marketing"],
          },
        },
      });
      preconditions.hasLocalSchema({ components: [comp] as any, datasources: [] });
      preconditions.hasRemoteComponents([]);
      preconditions.hasRemoteFolders([]);
      preconditions.hasRemoteDatasources([]);
      preconditions.hasRemoteTags([{ id: 555, name: "Marketing" }]);
      const bodies = capturesComponentCreate(comp);

      await schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
      ]);

      expect(bodies[0]?.schema.body.component_tag_whitelist).toEqual([555]);
    });

    it("should report a block tagged the same as the remote block as unchanged", async () => {
      const comp = makeMockComponent({ name: "hero" });
      preconditions.hasLocalSchema({
        components: [{ ...comp, tags: ["Marketing"] }] as any,
        datasources: [],
      });
      preconditions.hasRemoteComponents([{ ...comp, internal_tag_ids: ["555"] } as any]);
      preconditions.hasRemoteFolders([]);
      preconditions.hasRemoteDatasources([]);
      preconditions.hasRemoteTags([{ id: 555, name: "Marketing" }]);

      await schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
      ]);

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("nothing to push"));
    });
  });

  it("should handle API errors gracefully", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasLocalSchema({
      components: [comp] as any,
      datasources: [],
    });
    preconditions.failsToFetchRemote();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--dry-run",
    ]);

    // handleError outputs to console.error
    expect(console.error).toHaveBeenCalled();
  });

  // Regression: two blocks sharing a name used to produce two `create` diffs for
  // the same name, both resolving to the first definition — the second was
  // dropped and the concurrent creates raced, aborting mid-push.
  it("should abort before any API call when two blocks share a name", async () => {
    await preconditions.hasDuplicateBlockNamesInEntryFile();

    await schemaCommand.parseAsync(["node", "test", "push", "schema.ts", "--space", DEFAULT_SPACE]);

    expect(process.exitCode).toBe(2);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate schema definitions: block name "hero"'),
    );
    // No remote handlers are registered and msw runs with onUnhandledRequest:
    // 'error', so any request during this push would fail the test.
  });

  it("should warn when entry file has zero exports", async () => {
    preconditions.hasLocalSchema({
      components: [],
      datasources: [],
    });

    await schemaCommand.parseAsync(["node", "test", "push", "schema.ts", "--space", DEFAULT_SPACE]);

    // ui.warn outputs to console.warn; verify the zero-export warning was shown
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("No components, folders, or datasources"),
    );
  });

  it("pushes a folders-only schema instead of warning about no entities", async () => {
    preconditions.hasLocalSchema({
      components: [],
      datasources: [],
      folders: [{ name: "Layout", path: "layout", parentPath: null }],
    });
    preconditions.hasEmptyRemote();
    server.use(
      http.post(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/component_groups`,
        async ({ request }) => {
          const body = (await request.json()) as { component_group: { name: string } };
          return HttpResponse.json({
            component_group: { id: 1, uuid: "u1", name: body.component_group.name },
          });
        },
      ),
    );

    await schemaCommand.parseAsync(["node", "test", "push", "schema.ts", "--space", DEFAULT_SPACE]);

    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining("No components"));
    // The folder create diff was rendered (the gate no longer short-circuits).
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("1 to create"));
  });

  it("warns that deleting a stale folder will ungroup its remote components", async () => {
    const localHero = makeMockComponent({
      name: "hero",
      schema: { title: { type: "text", pos: 0 } },
    });
    const remoteHero = { ...localHero, component_group_uuid: "u-layout" };
    preconditions.hasLocalSchema({ components: [localHero] as any, datasources: [] });
    preconditions.hasRemoteComponents([remoteHero]);
    preconditions.hasRemoteFolders([{ id: 10, name: "Layout", uuid: "u-layout" }]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    server.use(
      http.delete(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/component_groups/:id`,
        () => HttpResponse.json({}),
      ),
    );

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--delete",
    ]);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Folder 'layout' will be deleted; 1 component(s) inside will be ungrouped.",
      ),
    );
  });

  it("excludes stale (deleted) components from the ungroup count", async () => {
    // `keep` stays (declared locally, unmanaged), `gone` is stale and deleted.
    // Both live in the Layout group remotely; only `keep` is truly ungrouped.
    const keep = makeMockComponent({ name: "keep", schema: { title: { type: "text", pos: 0 } } });
    const keepRemote = { ...keep, component_group_uuid: "u-layout" };
    const goneRemote = { ...makeMockComponent({ name: "gone" }), component_group_uuid: "u-layout" };
    preconditions.hasLocalSchema({ components: [keep] as any, datasources: [] });
    preconditions.hasRemoteComponents([keepRemote, goneRemote]);
    preconditions.hasRemoteFolders([{ id: 10, name: "Layout", uuid: "u-layout" }]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    server.use(
      http.delete(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components/:id`, () =>
        HttpResponse.json({}),
      ),
      http.delete(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/component_groups/:id`,
        () => HttpResponse.json({}),
      ),
    );

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--delete",
    ]);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Folder 'layout' will be deleted; 1 component(s) inside will be ungrouped.",
      ),
    );
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("2 component(s) inside will be ungrouped"),
    );
  });

  it("should not include stale entities in changeset without --delete", async () => {
    const localComp = makeMockComponent({
      name: "hero",
      schema: { title: { type: "text", pos: 0 } },
    });
    const staleComp = makeMockComponent({ name: "footer" });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([localComp, staleComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);

    await schemaCommand.parseAsync(["node", "test", "push", "schema.ts", "--space", DEFAULT_SPACE]);

    // Without --delete, the changeset should not contain delete entries for stale entities
    const changesetFile = Object.entries(vol.toJSON()).find(([filename]) =>
      filename.includes("schema/changesets/"),
    )?.[1];
    const changeset = JSON.parse(changesetFile ?? "{}");
    expect(changeset.changes).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("nothing to push"));
  });

  it("should generate migration file when field is renamed", async () => {
    const remoteComp = makeMockComponent({
      name: "hero",
      schema: {
        author_name: { type: "text", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: "hero",
      schema: {
        author: { type: "text", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();
    preconditions.confirmsMigrations();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--typed",
    ]);

    const migration = writtenFile(`migrations/${DEFAULT_SPACE}/20261016090503-update-hero.ts`);
    expect(migration).toContain("import type { Schema } from '../../../schema.js';");
    expect(migration).toContain("export default defineMigration<Schema, Before>({");
    expect(migration).toContain("title: 'Update hero: rename author_name to author',");
    expect(migration).toContain(
      "renameField({ block: 'hero', field: 'author_name', to: 'author' })",
    );
    expect(
      writtenFile(`migrations/${DEFAULT_SPACE}/20261016090503-update-hero.before.ts`),
    ).toContain("defineField('author_name'");
  });

  it("should title a typed migration after its changes, or its blocks when those are too long", async () => {
    const blocks = ["hero", "teaser", "card", "banner"];
    preconditions.hasLocalSchema({
      components: blocks.map((name) =>
        makeMockComponent({
          name,
          schema: {
            title: { type: "text", pos: 0, required: true },
            rating: { type: "number", pos: 1 },
          },
        }),
      ) as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents(
      blocks.map((name) =>
        makeMockComponent({
          name,
          schema: {
            title: { type: "text", pos: 0 },
            rating: { type: "text", pos: 1 },
            legacy: { type: "asset", pos: 2 },
          },
        }),
      ),
    );
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--typed",
      "--migrations",
    ]);

    expect(
      writtenFile(`migrations/${DEFAULT_SPACE}/20261016090503-update-banner-card-hero-teaser.ts`),
    ).toContain("title: 'Update banner, card, hero, and teaser',");
  });

  it("should title a typed migration of one block after its changes", async () => {
    preconditions.hasLocalSchema({
      components: [
        makeMockComponent({
          name: "hero",
          schema: {
            title: { type: "text", pos: 0, required: true },
            rating: { type: "number", pos: 1 },
          },
        }),
      ] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([
      makeMockComponent({
        name: "hero",
        schema: {
          title: { type: "text", pos: 0 },
          rating: { type: "text", pos: 1 },
          legacy: { type: "asset", pos: 2 },
        },
      }),
    ]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--typed",
      "--migrations",
    ]);

    expect(writtenFile(`migrations/${DEFAULT_SPACE}/20261016090503-update-hero.ts`)).toContain(
      "title: 'Update hero: remove legacy, convert rating to number, require title',",
    );
  });

  it("should generate an alterField for option values the schema removed", async () => {
    const options = (...values: string[]) => values.map((value) => ({ name: value, value }));
    const remoteComp = makeMockComponent({
      name: "hero",
      schema: {
        size: { type: "option", pos: 0, options: options(" ", "normal", "large") },
        tags: { type: "options", pos: 1, options: options("new", "old") },
        source: { type: "option", pos: 2, source: "internal", datasource_slug: "sizes" },
      },
    });
    const localComp = makeMockComponent({
      name: "hero",
      schema: {
        size: { type: "option", pos: 0, options: options("normal", "large", "huge") },
        tags: { type: "options", pos: 1, options: options("new") },
        source: { type: "option", pos: 2, source: "internal", datasource_slug: "other" },
      },
    });
    preconditions.hasLocalSchema({ components: [localComp] as any, datasources: [] });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--typed",
      "--migrations",
    ]);

    const migration = writtenFile(`migrations/${DEFAULT_SPACE}/20261016090503-update-hero.ts`);
    expect(migration).toContain("alterField({ block: 'hero', field: 'size' }, (value) => {");
    expect(migration).toContain("if (value === ' ') {");
    expect(migration).toContain(
      "if (Array.isArray(value) && value.some((item) => item === 'old')) {",
    );
    expect(migration).not.toContain("field: 'source'");
    expect(
      writtenFile(`migrations/${DEFAULT_SPACE}/20261016090503-update-hero.before.ts`),
    ).toContain("value: ' '");
  });

  describe("when a block is renamed", () => {
    const banner = () =>
      makeMockComponent({
        name: "banner",
        is_root: true,
        schema: { headline: { type: "text", pos: 0 }, body: { type: "textarea", pos: 1 } },
      });
    const hero = () =>
      makeMockComponent({
        name: "hero",
        is_root: true,
        schema: { title: { type: "text", pos: 0 }, body: { type: "textarea", pos: 1 } },
      });
    /**
     * Records block writes. With `usage`, the stories by the blocks they
     * contain, a rename with `update_content` moves the stories using the old
     * name to the new one, after `pollsUntilRenamed` story counts when the
     * space renames them in the background. The first `busyUpdates` updates
     * are refused, as a space does while it renames in the background.
     */
    const componentWrites = (
      remote: MockComponent[] = [],
      usage?: Record<string, number>,
      { pollsUntilRenamed = 0, busyUpdates = 0, failing = [] as number[] } = {},
    ) => {
      const writes: { method: string; id?: string; name?: string; updateContent?: boolean }[] = [];
      let pollsLeft = 0;
      let busyLeft = busyUpdates;
      let pendingRename: { from: string; to: string } | undefined;
      const record =
        (method: string) =>
        async ({ request, params }: { request: Request; params: Record<string, unknown> }) => {
          if (method === "PUT" && busyLeft > 0) {
            busyLeft--;
            return HttpResponse.json(
              {
                error:
                  "A job to rename the component or it's attribute is running in the background. Please wait until it is finished.",
              },
              { status: 422 },
            );
          }
          if (failing.includes(Number(params.id))) {
            return HttpResponse.json({ error: "Server error" }, { status: 500 });
          }
          const body = method === "DELETE" ? undefined : await request.json();
          const name = (body as { component?: { name?: string } } | undefined)?.component?.name;
          const updateContent = new URL(request.url).searchParams.get("update_content") === "true";
          writes.push({
            method,
            id: params.id === undefined ? undefined : String(params.id),
            name,
            ...(updateContent && { updateContent }),
          });
          const from = remote.find((c) => String(c.id) === params.id)?.name;
          if (updateContent && from && name && from !== name) {
            pendingRename = { from, to: name };
            pollsLeft = pollsUntilRenamed;
          }
          return HttpResponse.json({ component: { id: getID(), name } });
        };
      const url = `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`;
      server.use(
        http.post(url, record("POST")),
        http.put(`${url}/:id`, record("PUT")),
        http.delete(`${url}/:id`, record("DELETE")),
      );
      if (!usage) return writes;
      server.use(
        http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, ({ request }) => {
          if (pendingRename && pollsLeft-- <= 0) {
            usage[pendingRename.to] =
              (usage[pendingRename.to] ?? 0) + (usage[pendingRename.from] ?? 0);
            usage[pendingRename.from] = 0;
            pendingRename = undefined;
          }
          const block = new URL(request.url).searchParams.get("contain_component") ?? "";
          return HttpResponse.json(
            { stories: [] },
            { headers: { Total: String(usage[block] ?? 0) } },
          );
        }),
      );
      return writes;
    };
    const push = (...args: string[]) =>
      schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
        ...args,
      ]);

    beforeEach(() => {
      preconditions.hasRemoteFolders([]);
      preconditions.hasRemoteDatasources([]);
      preconditions.hasRemoteTags([]);
    });

    it("should rename the block in place and in its stories when the rename is confirmed", async () => {
      const remoteBanner = banner();
      preconditions.hasLocalSchema({ components: [hero()] as any, datasources: [] });
      preconditions.hasRemoteComponents([remoteBanner]);
      const writes = componentWrites([remoteBanner], { banner: 3 });
      vi.mocked(confirm).mockResolvedValue(true);

      await push("--typed", "--delete");

      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Rename block banner → hero (3 stories)?"),
        }),
        expect.anything(),
      );
      expect(writes).toEqual([
        { method: "PUT", id: String(remoteBanner.id), name: "hero", updateContent: true },
      ]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Renamed banner → hero in the space, along with the stories and folders that use it.",
        ),
      );
    });

    it("should address the renamed block by its new name in the typed migration", async () => {
      const remoteBanner = banner();
      preconditions.hasLocalSchema({ components: [hero()] as any, datasources: [] });
      preconditions.hasRemoteComponents([remoteBanner]);
      componentWrites([remoteBanner], { banner: 3 });
      vi.mocked(confirm).mockResolvedValue(true);

      await push("--typed");

      const migration = writtenFile("20261016090503-update-hero.ts");
      expect(migration).toContain("title: 'Update hero: rename headline to title',");
      expect(migration).toContain("renameField({ block: 'hero', field: 'headline', to: 'title' })");
      expect(migration).not.toContain("renameBlock");
      const before = writtenFile("20261016090503-update-hero.before.ts");
      expect(before).toContain("name: 'hero'");
      expect(before).toContain("defineField('headline'");
    });

    it("should write the .js migration of a renamed block under its new name", async () => {
      const remoteBanner = banner();
      preconditions.hasLocalSchema({ components: [hero()] as any, datasources: [] });
      preconditions.hasRemoteComponents([remoteBanner]);
      componentWrites([remoteBanner], { banner: 3 });
      vi.mocked(confirm).mockResolvedValue(true);

      await push("--migrations");

      const files = migrationFiles();
      expect(files).toEqual([expect.stringMatching(/\/hero\.[^/]+\.js$/)]);
      expect(writtenFile(files[0])).not.toContain("block.component");
    });

    it("should rename a block whose fields didn't change", async () => {
      const remoteBanner = banner();
      preconditions.hasLocalSchema({
        components: [{ ...banner(), name: "hero" }] as any,
        datasources: [],
      });
      preconditions.hasRemoteComponents([remoteBanner]);
      const writes = componentWrites([remoteBanner], { banner: 3 });
      vi.mocked(confirm).mockResolvedValue(true);

      await push("--typed");

      expect(writes).toEqual([
        { method: "PUT", id: String(remoteBanner.id), name: "hero", updateContent: true },
      ]);
      expect(migrationFiles()).toEqual([]);
    });

    it("should wait until the space renamed the block in its stories in the background", async () => {
      const remoteBanner = banner();
      preconditions.hasLocalSchema({ components: [hero()] as any, datasources: [] });
      preconditions.hasRemoteComponents([remoteBanner]);
      const usage = { banner: 300 };
      componentWrites([remoteBanner], usage, { pollsUntilRenamed: 3 });
      vi.mocked(confirm).mockResolvedValue(true);

      await push("--no-migrations");

      expect(usage).toEqual({ banner: 0, hero: 300 });
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Schema pushed to space"));
    });

    it("should update the other blocks before it renames one, and rename one block at a time", async () => {
      const remoteBanner = banner();
      const remoteCard = makeMockComponent({
        name: "card",
        schema: { label: { type: "text", pos: 0 }, image: { type: "asset", pos: 1 } },
      });
      const remoteTeaser = makeMockComponent({ name: "teaser", schema: { a: { type: "text" } } });
      preconditions.hasLocalSchema({
        components: [
          hero(),
          { ...remoteCard, name: "tile" },
          { ...remoteTeaser, schema: { b: { type: "text" } } },
        ] as any,
        datasources: [],
      });
      const remote = [remoteBanner, remoteCard, remoteTeaser];
      preconditions.hasRemoteComponents(remote);
      const writes = componentWrites(remote, { banner: 300, card: 300 }, { pollsUntilRenamed: 2 });
      vi.mocked(confirm).mockResolvedValue(true);

      await push("--no-migrations");

      expect(writes).toEqual([
        { method: "PUT", id: String(remoteTeaser.id), name: "teaser" },
        { method: "PUT", id: String(remoteBanner.id), name: "hero", updateContent: true },
        { method: "PUT", id: String(remoteCard.id), name: "tile", updateContent: true },
      ]);
    });

    it("should retry a rename while the space renames another block in the background", async () => {
      const remoteBanner = banner();
      preconditions.hasLocalSchema({ components: [hero()] as any, datasources: [] });
      preconditions.hasRemoteComponents([remoteBanner]);
      const writes = componentWrites([remoteBanner], { banner: 3 }, { busyUpdates: 2 });
      vi.mocked(confirm).mockResolvedValue(true);

      await push("--no-migrations");

      expect(writes).toEqual([
        { method: "PUT", id: String(remoteBanner.id), name: "hero", updateContent: true },
      ]);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Schema pushed to space"));
    });

    it("should fail when the space doesn't finish renaming the block in its stories in time", async () => {
      const remoteBanner = banner();
      const remoteTeaser = makeMockComponent({ name: "teaser", schema: { a: { type: "text" } } });
      preconditions.hasLocalSchema({ components: [hero()] as any, datasources: [] });
      preconditions.hasRemoteComponents([remoteBanner, remoteTeaser]);
      const writes = componentWrites(
        [remoteBanner, remoteTeaser],
        { banner: 300 },
        {
          pollsUntilRenamed: Number.POSITIVE_INFINITY,
        },
      );
      vi.mocked(confirm).mockResolvedValue(true);
      const startedAt = Date.now();

      await push("--no-migrations", "--delete", "--force");

      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(RENAME_TIMEOUT_MS);
      expect(writes).toEqual([
        { method: "PUT", id: String(remoteBanner.id), name: "hero", updateContent: true },
      ]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "The space is still renaming banner to hero in the stories that use it. Wait until it finishes, then run schema push again",
        ),
      );
    });

    it("should not rename the block when the rest of the push fails", async () => {
      const remoteBanner = banner();
      const remoteTeaser = makeMockComponent({ name: "teaser", schema: { a: { type: "text" } } });
      preconditions.hasLocalSchema({
        components: [hero(), { ...remoteTeaser, schema: { b: { type: "text" } } }] as any,
        datasources: [],
      });
      preconditions.hasRemoteComponents([remoteBanner, remoteTeaser]);
      const writes = componentWrites(
        [remoteBanner, remoteTeaser],
        { banner: 3 },
        {
          failing: [remoteTeaser.id],
        },
      );
      vi.mocked(confirm).mockResolvedValue(true);

      await push("--no-migrations");

      expect(writes).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update component teaser"),
      );
    });

    it("should refuse to delete a block stories still use when the rename is declined", async () => {
      preconditions.hasLocalSchema({ components: [hero()] as any, datasources: [] });
      preconditions.hasRemoteComponents([banner()]);
      preconditions.hasStories({ banner: 3 });
      const writes = componentWrites();
      vi.mocked(confirm).mockResolvedValue(false);

      await push("--no-migrations", "--delete");

      expect(writes).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Stories still use this block, which --delete would delete: banner (3 stories).",
        ),
      );
    });

    it("should delete a block stories still use with --force and warn about folders naming it", async () => {
      const remoteBanner = banner();
      preconditions.hasLocalSchema({ components: [hero()] as any, datasources: [] });
      preconditions.hasRemoteComponents([remoteBanner]);
      const folderUpdates = preconditions.hasStories({ banner: 3 }, [
        { id: 7, full_slug: "banners", default_root: "banner", content_types: ["banner"] },
      ]);
      const writes = componentWrites();
      vi.mocked(confirm).mockResolvedValue(false);

      await push("--no-migrations", "--delete", "--force");

      expect(writes).toEqual([
        { method: "POST", id: undefined, name: "hero" },
        { method: "DELETE", id: String(remoteBanner.id), name: undefined },
      ]);
      expect(folderUpdates).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Folder banners still names the deleted banner as a content type."),
      );
    });

    it.each([403, 500])(
      "should refuse to delete a block when its stories can't be counted (%i)",
      async (status) => {
        const page = makeMockComponent({ name: "page" });
        preconditions.hasLocalSchema({ components: [page] as any, datasources: [] });
        preconditions.hasRemoteComponents([page, banner()]);
        preconditions.failsToCountStories(status);
        const writes = componentWrites();

        await push("--no-migrations", "--delete");

        expect(writes).toEqual([]);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining(
            "Could not check whether stories use banner, which --delete would delete",
          ),
        );
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("Pass --force to delete it without checking."),
        );
      },
    );

    it("should delete a block without counting its stories with --force", async () => {
      const remoteBanner = banner();
      const page = makeMockComponent({ name: "page" });
      preconditions.hasLocalSchema({ components: [page] as any, datasources: [] });
      preconditions.hasRemoteComponents([page, remoteBanner]);
      preconditions.failsToCountStories(500);
      const writes = componentWrites();

      await push("--no-migrations", "--delete", "--force");

      expect(writes).toEqual([{ method: "DELETE", id: String(remoteBanner.id), name: undefined }]);
    });

    it("should name the possible rename on a dry run without asking", async () => {
      preconditions.hasLocalSchema({ components: [hero()] as any, datasources: [] });
      preconditions.hasRemoteComponents([banner()]);
      preconditions.hasStories({ banner: 3 });

      await push("--dry-run");

      expect(confirm).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Possible block rename: banner → hero (3 stories)."),
      );
    });

    it("should not pair blocks that share too few fields", async () => {
      preconditions.hasLocalSchema({
        components: [
          makeMockComponent({
            name: "hero",
            is_root: true,
            schema: { cta: { type: "text", pos: 0 } },
          }),
        ] as any,
        datasources: [],
      });
      preconditions.hasRemoteComponents([banner()]);
      componentWrites();

      await push("--no-migrations");

      expect(confirm).not.toHaveBeenCalled();
    });
  });

  it("should skip the snapshot with --no-before", async () => {
    const remoteComp = makeMockComponent({
      name: "hero",
      schema: { author_name: { type: "text", pos: 0 }, title: { type: "text", pos: 1 } },
    });
    const localComp = makeMockComponent({
      name: "hero",
      schema: { author: { type: "text", pos: 0 }, title: { type: "text", pos: 1 } },
    });
    preconditions.hasLocalSchema({ components: [localComp] as any, datasources: [] });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--typed",
      "--migrations",
      "--no-before",
    ]);

    expect(writtenFile("20261016090503-update-hero.ts")).toContain("defineMigration<Schema>({");
    expect(writtenFile(".before.ts")).toBeUndefined();
  });

  describe("with content migrations this machine hasn't run", () => {
    const MIGRATIONS = `.storyblok/migrations/${DEFAULT_SPACE}`;
    const pushChangingHero = async (remoteSchema: Record<string, Record<string, unknown>>) => {
      const remoteComp = makeMockComponent({ name: "hero", schema: remoteSchema });
      preconditions.hasLocalSchema({
        components: [{ ...remoteComp, schema: { title: { type: "text", pos: 0 } } }] as any,
        datasources: [],
      });
      preconditions.hasRemoteComponents([remoteComp]);
      preconditions.hasRemoteFolders([]);
      preconditions.hasRemoteDatasources([]);
      preconditions.hasRemoteTags([]);
      preconditions.canUpdateComponents();
      await schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
        "--no-migrations",
      ]);
    };

    beforeEach(() => {
      vol.fromJSON({
        [`${MIGRATIONS}/20261001000000-rename-card-title.ts`]: "export default {};",
        [`${MIGRATIONS}/20261002000000-split-name.ts`]: "export default {};",
        [`${MIGRATIONS}/rollbacks/run-1.json`]: JSON.stringify({
          id: "run-1",
          migration: "20261001000000-rename-card-title",
          space: DEFAULT_SPACE,
          appliedAt: "2026-10-01T00:00:00.000Z",
          stories: 1,
          blocks: 1,
        }),
      });
    });

    it("should warn about them and say to run them before the push", async () => {
      await pushChangingHero({ subtitle: { type: "text", pos: 0 } });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `1 content migration hasn't run on this machine: 20261002000000-split-name. Run it with \`storyblok migrations run --space ${DEFAULT_SPACE}\` before you push schema changes`,
        ),
      );
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Schema pushed to space"));
    });

    it("should not warn when the push changes nothing", async () => {
      await pushChangingHero({ title: { type: "text", pos: 0 } });

      expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining("run on this machine"));
    });
  });

  it("should skip migration generation with --no-migrations", async () => {
    const remoteComp = makeMockComponent({
      name: "hero",
      schema: {
        author_name: { type: "text", pos: 0 },
      },
    });
    const localComp = makeMockComponent({
      name: "hero",
      schema: {
        author: { type: "text", pos: 0 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--no-migrations",
    ]);

    expect(migrationFiles()).toHaveLength(0);
    expect(confirm).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining("--typed"));
  });

  it("should warn that --typed has no effect with --no-migrations", async () => {
    const remoteComp = makeMockComponent({
      name: "hero",
      schema: { author_name: { type: "text" } },
    });
    preconditions.hasLocalSchema({
      components: [{ ...remoteComp, schema: { author: { type: "text" } } }] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--typed",
      "--no-migrations",
    ]);

    expect(migrationFiles()).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("--typed has no effect with --no-migrations."),
    );
  });

  it("should not generate migration files when user declines", async () => {
    const remoteComp = makeMockComponent({
      name: "hero",
      schema: {
        subtitle: { type: "text", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: "hero",
      schema: {
        title: { type: "text", pos: 0 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();
    preconditions.declinesPrompt();

    await schemaCommand.parseAsync(["node", "test", "push", "schema.ts", "--space", DEFAULT_SPACE]);

    expect(migrationFiles()).toHaveLength(0);
  });

  it("should auto-generate migrations without prompting when --migrations is explicit", async () => {
    const remoteComp = makeMockComponent({
      name: "hero",
      schema: {
        subtitle: { type: "text", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: "hero",
      schema: {
        title: { type: "text", pos: 0 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--typed",
      "--migrations",
    ]);

    // Should generate without prompting
    expect(migrationFiles()).toEqual([
      expect.stringMatching(/20261016090503-update-hero\.before\.ts$/),
      expect.stringMatching(/20261016090503-update-hero\.ts$/),
    ]);
    // confirm should NOT have been called (auto-generate mode)
    expect(confirm).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Generated migrations are scaffolds"),
    );
  });

  it("should log assumed renames when --migrations is explicit", async () => {
    const remoteComp = makeMockComponent({
      name: "hero",
      schema: {
        author_name: { type: "text", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: "hero",
      schema: {
        author: { type: "text", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--migrations",
    ]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Assumed rename"));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("author_name"));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("author"));
  });

  it("should generate migration for type changes", async () => {
    const remoteComp = makeMockComponent({
      name: "hero",
      schema: {
        rating: { type: "text", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: "hero",
      schema: {
        rating: { type: "number", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();
    preconditions.confirmsMigrations();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--typed",
    ]);

    expect(writtenFile("20261016090503-update-hero.ts")).toContain(
      "coerceField({ block: 'hero', field: 'rating', from: 'string', to: 'number' })",
    );
  });

  it("should point out a possible rename when a removed field matches a new required field", async () => {
    preconditions.hasLocalSchema({
      components: [
        makeMockComponent({
          name: "teaser",
          schema: { headline: { type: "text", pos: 0, required: true } },
        }),
      ] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([
      makeMockComponent({ name: "teaser", schema: { title: { type: "text", pos: 0 } } }),
    ]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--typed",
      "--migrations",
    ]);

    const migration = writtenFile("20261016090503-update-teaser.ts");
    expect(commentsIn(migration)).toContain(
      "TODO: if 'title' was renamed to 'headline', replace this removeField and the addField of 'headline' with renameField, or the content of 'title' is lost.",
    );
    expect(migration).toMatch(/lost\.\n\s+removeField\(\{ block: 'teaser', field: 'title' \}\),/);
  });

  it("should name, for each possible rename of a removed field, only the ops the migration holds", async () => {
    preconditions.hasLocalSchema({
      components: [
        makeMockComponent({
          name: "author",
          schema: {
            x_handle: { type: "text", pos: 0 },
            role: { type: "text", pos: 1, required: true },
            avatar: { type: "asset", pos: 2 },
          },
        }),
      ] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([
      makeMockComponent({
        name: "author",
        schema: {
          x_account: { type: "text", pos: 0 },
          instagram_account: { type: "text", pos: 1 },
        },
      }),
    ]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--typed",
      "--migrations",
    ]);

    const migration = writtenFile("20261016090503-update-author.ts");
    expect(commentsIn(migration)).toContain(
      "TODO: if 'x_account' was renamed to 'x_handle', replace this removeField with renameField; if it was renamed to 'role', replace this removeField and the addField of 'role' with renameField. Otherwise, the content of 'x_account' is lost.",
    );
    expect(migration).not.toContain("addField({ block: 'author', field: 'x_handle'");
    expect(migration).not.toContain("'avatar'");
  });

  it("should not treat switching among text, textarea, and markdown as breaking", async () => {
    preconditions.hasLocalSchema({
      components: [
        makeMockComponent({ name: "hero", schema: { body: { type: "markdown", pos: 0 } } }),
      ] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([
      makeMockComponent({ name: "hero", schema: { body: { type: "textarea", pos: 0 } } }),
    ]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--migrations",
    ]);

    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining("breaking change"));
    expect(migrationFiles()).toEqual([]);
  });

  it("should quote a --path with spaces in the run hint", async () => {
    preconditions.hasLocalSchema({
      components: [
        makeMockComponent({ name: "hero", schema: { title: { type: "text", pos: 0 } } }),
      ] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([
      makeMockComponent({
        name: "hero",
        schema: { subtitle: { type: "text", pos: 0 }, title: { type: "text", pos: 1 } },
      }),
    ]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    // `--path` is a global option, so it lives on the root program.
    const program = schemaCommand.parent;
    if (!program) throw new Error("schema command is not registered on the program");
    const previousPath: unknown = program.getOptionValue("path");
    program.setOptionValue("path", "my project");
    try {
      await schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
        "--typed",
        "--migrations",
      ]);
    } finally {
      program.setOptionValue("path", previousPath);
    }

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `storyblok migrations run --space ${DEFAULT_SPACE} --path 'my project'`,
      ),
    );
  });

  it("should remove the migration when the push fails before any block is updated", async () => {
    preconditions.hasLocalSchema({
      components: [
        makeMockComponent({ name: "hero", schema: { title: { type: "text", pos: 0 } } }),
      ] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([
      makeMockComponent({
        name: "hero",
        schema: { subtitle: { type: "text", pos: 0 }, title: { type: "text", pos: 1 } },
      }),
    ]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.failsToUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--migrations",
      "--typed",
    ]);

    expect(migrationFiles()).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("before any block with breaking changes was updated"),
    );
  });

  it("should keep the migration for the blocks a failed push updated", async () => {
    const remoteArticle = makeMockComponent({
      name: "article",
      schema: { slug_override: { type: "text", pos: 0 } },
    });
    const remoteTeaser = makeMockComponent({
      name: "teaser",
      schema: { link: { type: "text", pos: 0 }, title: { type: "text", pos: 1 } },
    });
    const localArticle = { ...remoteArticle, schema: { slug_custom: { type: "text", pos: 0 } } };
    const localTeaser = { ...remoteTeaser, schema: { title: { type: "text", pos: 0 } } };
    preconditions.hasLocalSchema({
      components: [localArticle, localTeaser] as any,
      datasources: [],
    });
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.updatesOnlyComponent(localArticle, [remoteArticle, remoteTeaser]);

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--migrations",
      "--typed",
    ]);

    expect(migrationFiles()).toEqual([
      expect.stringMatching(/\d{14}-update-article\.before\.ts$/),
      expect.stringMatching(/\d{14}-update-article\.ts$/),
    ]);
    const migration = writtenFile("-update-article.ts");
    expect(migration).toContain(
      "renameField({ block: 'article', field: 'slug_override', to: 'slug_custom' })",
    );
    expect(migration).not.toContain("teaser");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("The push failed, but it updated article."),
    );
  });

  it("should leave the blocks a failed push didn't change out of migrations generate --before-push", async () => {
    const remoteArticle = makeMockComponent({
      name: "article",
      schema: { slug_override: { type: "text", pos: 0 } },
    });
    const remoteTeaser = makeMockComponent({
      name: "teaser",
      schema: { link: { type: "text", pos: 0 }, title: { type: "text", pos: 1 } },
    });
    const localArticle = { ...remoteArticle, schema: { slug_custom: { type: "text", pos: 0 } } };
    const localTeaser = { ...remoteTeaser, schema: { title: { type: "text", pos: 0 } } };
    preconditions.hasLocalSchema({
      components: [localArticle, localTeaser] as any,
      datasources: [],
    });
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.updatesOnlyComponent(localArticle, [remoteArticle, remoteTeaser]);
    vol.fromJSON({ "schema.ts": "export type Schema = {};" });
    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--no-migrations",
    ]);
    vi.mocked(console.error).mockClear();

    const generate = (block: string) =>
      migrationsCommand.parseAsync([
        "node",
        "test",
        "generate",
        block,
        "--space",
        DEFAULT_SPACE,
        "--schema",
        "schema.ts",
        "--before-push",
      ]);
    await generate("article");
    await generate("teaser");

    expect(writtenFile("-article.before.ts")).toContain("defineField('slug_override'");
    expect(writtenFile("-teaser.ts")).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `No schema push to space ${DEFAULT_SPACE} recorded a change to teaser`,
      ),
    );
  });

  it("should write one .js migration per block by default", async () => {
    const remoteComp = makeMockComponent({
      name: "hero",
      schema: {
        author_name: { type: "text", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: "hero",
      schema: {
        author: { type: "text", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--migrations",
    ]);

    const migrationFile = Object.entries(vol.toJSON()).find(
      ([filename]) =>
        filename.includes("migrations/") && filename.includes("hero.") && filename.endsWith(".js"),
    );
    expect(migrationFile).toBeDefined();
    expect(migrationFile![1]).toContain(
      "Review this migration before running it against your space.",
    );
    expect(migrationFile![1]).toContain("Generated migrations are scaffolds");
    expect(migrationFile![1]).toContain("block.new_field = block.old_field;");
  });

  it.each(["../hero", "hero/v2"])(
    "should write the .js migration of block %s inside the migrations directory",
    async (name) => {
      const remoteComp = makeMockComponent({
        name,
        schema: { author_name: { type: "text", pos: 0 }, title: { type: "text", pos: 1 } },
      });
      const localComp = {
        ...remoteComp,
        schema: { author: { type: "text", pos: 0 }, title: { type: "text", pos: 1 } },
      };
      preconditions.hasLocalSchema({ components: [localComp] as any, datasources: [] });
      preconditions.hasRemoteComponents([remoteComp]);
      preconditions.hasRemoteFolders([]);
      preconditions.hasRemoteDatasources([]);
      preconditions.hasRemoteTags([]);
      preconditions.canUpdateComponents();

      await schemaCommand.parseAsync([
        "node",
        "test",
        "push",
        "schema.ts",
        "--space",
        DEFAULT_SPACE,
        "--migrations",
      ]);

      const files = Object.keys(vol.toJSON()).filter((file) => file.endsWith(".js"));
      expect(files).toEqual([
        expect.stringMatching(new RegExp(`/migrations/${DEFAULT_SPACE}/[^/]+\\.js$`)),
      ]);
    },
  );

  it("should not write migration files when --dry-run is used with explicit --migrations", async () => {
    const remoteComp = makeMockComponent({
      name: "hero",
      schema: {
        author_name: { type: "text", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: "hero",
      schema: {
        author: { type: "text", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--dry-run",
      "--migrations",
    ]);

    expect(migrationFiles()).toHaveLength(0);
    expect(confirm).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
  });

  it("should not prompt or write files when --dry-run is used with default migrations", async () => {
    const remoteComp = makeMockComponent({
      name: "hero",
      schema: {
        subtitle: { type: "text", pos: 0 },
        title: { type: "text", pos: 1 },
      },
    });
    const localComp = makeMockComponent({
      name: "hero",
      schema: {
        title: { type: "text", pos: 0 },
      },
    });
    preconditions.hasLocalSchema({
      components: [localComp] as any,
      datasources: [],
    });
    preconditions.hasRemoteComponents([remoteComp]);
    preconditions.hasRemoteFolders([]);
    preconditions.hasRemoteDatasources([]);
    preconditions.hasRemoteTags([]);

    await schemaCommand.parseAsync([
      "node",
      "test",
      "push",
      "schema.ts",
      "--space",
      DEFAULT_SPACE,
      "--dry-run",
    ]);

    // Must not prompt — dry-run is non-interactive
    expect(confirm).not.toHaveBeenCalled();
    expect(migrationFiles()).toHaveLength(0);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
  });
});
