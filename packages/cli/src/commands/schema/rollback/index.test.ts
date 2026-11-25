import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
import { confirm, select } from "@inquirer/prompts";
import { join } from "pathe";

import "../index";
import { schemaCommand } from "../command";
import { CHANGESETS_DIR } from "../changeset";
import { DEFAULT_SPACE, getID } from "../../__tests__/helpers";
import { resolveCommandPath } from "../../../utils/filesystem";
import type { ChangesetData } from "../types";

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

function makeChangeset(
  changes: ChangesetData["changes"],
  overrides: Partial<ChangesetData> = {},
): ChangesetData {
  return {
    timestamp: "2026-04-10T12:00:00.000Z",
    spaceId: Number(DEFAULT_SPACE),
    remote: { components: [], componentFolders: [], datasources: [] },
    changes,
    ...overrides,
  };
}

const changesetPath = (name: string) => join(resolveCommandPath(CHANGESETS_DIR), `${name}.json`);
const CHANGESET_PATH = changesetPath("20260410120000");
const OTHER_SPACE = 99999;

const server = setupServer();

const preconditions = {
  hasChangeset(changeset: ChangesetData) {
    this.hasChangesetFiles({ [CHANGESET_PATH]: changeset });
  },
  hasChangesetFiles(files: Record<string, ChangesetData | string>) {
    vol.fromJSON(
      Object.fromEntries(
        Object.entries(files).map(([path, content]) => [
          path,
          typeof content === "string" ? content : JSON.stringify(content),
        ]),
      ),
    );
  },
  hasRemoteComponents(components: MockComponent[]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ components }),
      ),
    );
  },
  hasRemoteFolders(componentGroups: Record<string, unknown>[] = []) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/component_groups`, () =>
        HttpResponse.json({ component_groups: componentGroups }),
      ),
    );
  },
  failsToDeleteComponents() {
    server.use(
      http.delete(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components/:id`, () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );
  },
  hasRemoteDatasources(datasources: Record<string, unknown>[] = []) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/datasources`, () =>
        HttpResponse.json({ datasources }),
      ),
    );
  },
  hasRemoteTags() {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/internal_tags`, () =>
        HttpResponse.json({ internal_tags: [] }),
      ),
    );
  },
  hasEmptyRemote() {
    this.hasRemoteComponents([]);
    this.hasRemoteFolders();
    this.hasRemoteDatasources();
    this.hasRemoteTags();
  },
  canCreateComponents() {
    server.use(
      http.post(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`,
        async ({ request }) => {
          const body = (await request.json()) as { component: { name: string } };
          return HttpResponse.json({ component: { id: getID(), ...body.component } });
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
  confirmsPrompt() {
    vi.mocked(confirm).mockResolvedValue(true);
  },
  cancelsPrompt() {
    vi.mocked(confirm).mockResolvedValue(false);
  },
};

describe("schema rollback command", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
  });

  afterAll(() => server.close());

  it("should show diff and stop in dry-run mode", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasChangeset(
      makeChangeset([{ type: "component", name: "hero", action: "create", after: { ...comp } }]),
    );
    // no remote fetch needed in dry-run (we stop before that)

    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      CHANGESET_PATH,
      "--space",
      DEFAULT_SPACE,
      "--dry-run",
    ]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
    // msw configured with onUnhandledRequest: 'error' — no fetch handlers registered, so any HTTP call would fail
  });

  it("includes folder operations in the rollback preview", async () => {
    preconditions.hasChangeset(
      makeChangeset([
        {
          type: "folder",
          name: "layout",
          action: "create",
          after: { name: "Layout", path: "layout", parentPath: null },
        },
      ]),
    );

    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      CHANGESET_PATH,
      "--space",
      DEFAULT_SPACE,
      "--dry-run",
    ]);

    // The folder is surfaced under a Folders section (create inverts to delete),
    // not skipped with a "not rolled back" note.
    const logged = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .flat()
      .join("\n");
    expect(logged).toContain("Folders");
    expect(logged).toContain("layout");
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining("not rolled back"));
  });

  it("should cancel when user declines confirmation", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasChangeset(
      makeChangeset([{ type: "component", name: "hero", action: "create", after: { ...comp } }]),
    );
    preconditions.cancelsPrompt();
    preconditions.hasEmptyRemote();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      CHANGESET_PATH,
      "--space",
      DEFAULT_SPACE,
    ]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("cancelled"));
  });

  it("should roll back a create by deleting the component", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasChangeset(
      makeChangeset([{ type: "component", name: "hero", action: "create", after: { ...comp } }]),
    );
    preconditions.confirmsPrompt();
    preconditions.hasRemoteComponents([comp]);
    preconditions.hasRemoteFolders();
    preconditions.hasRemoteDatasources();
    preconditions.hasRemoteTags();
    preconditions.canDeleteComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      CHANGESET_PATH,
      "--space",
      DEFAULT_SPACE,
    ]);

    // A new rollback changeset should be saved
    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.includes("schema/changesets/") && f !== CHANGESET_PATH)).toBe(true);
  });

  it("should roll back an update by restoring the before state", async () => {
    const comp = makeMockComponent({ name: "hero" });
    const before = { ...comp, display_name: "Old Hero" };
    const after = { ...comp, display_name: "New Hero" };
    preconditions.hasChangeset(
      makeChangeset([{ type: "component", name: "hero", action: "update", before, after }]),
    );
    preconditions.confirmsPrompt();
    preconditions.hasRemoteComponents([comp]);
    preconditions.hasRemoteFolders();
    preconditions.hasRemoteDatasources();
    preconditions.hasRemoteTags();
    preconditions.canUpdateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      CHANGESET_PATH,
      "--space",
      DEFAULT_SPACE,
    ]);

    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.includes("schema/changesets/") && f !== CHANGESET_PATH)).toBe(true);
  });

  it("should roll back a delete by recreating the component", async () => {
    const comp = makeMockComponent({ name: "footer" });
    preconditions.hasChangeset(
      makeChangeset([{ type: "component", name: "footer", action: "delete", before: { ...comp } }]),
    );
    preconditions.confirmsPrompt();
    preconditions.hasEmptyRemote();
    preconditions.canCreateComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      CHANGESET_PATH,
      "--space",
      DEFAULT_SPACE,
    ]);

    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.includes("schema/changesets/") && f !== CHANGESET_PATH)).toBe(true);
  });

  const savedChangesets = () =>
    Object.keys(vol.toJSON()).filter((f) => f.startsWith(resolveCommandPath(CHANGESETS_DIR)));

  const savedRollbackChangeset = (): string => {
    const saved = savedChangesets().find((f) => f !== CHANGESET_PATH);
    if (!saved) {
      throw new Error("No rollback changeset was saved");
    }
    return saved;
  };

  const rollBack = (...args: string[]) =>
    schemaCommand.parseAsync(["node", "test", "rollback", ...args, "--space", DEFAULT_SPACE]);

  it("should restore an updated datasource when the rollback itself is rolled back", async () => {
    const pushed = { id: 5, name: "Colors", slug: "colours", dimensions: [] };
    preconditions.hasChangeset(
      makeChangeset([
        {
          type: "datasource",
          name: "Colors",
          action: "update",
          before: { ...pushed, slug: "colors" },
          after: { name: "Colors", slug: "colours" },
        },
      ]),
    );
    preconditions.hasRemoteComponents([]);
    preconditions.hasRemoteFolders();
    preconditions.hasRemoteTags();
    preconditions.hasRemoteDatasources([pushed]);
    const updates: { name?: string; slug?: string }[] = [];
    server.use(
      http.patch(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/datasources/5`,
        async ({ request }) => {
          updates.push(((await request.json()) as { datasource: object }).datasource);
          return HttpResponse.json({ datasource: pushed });
        },
      ),
    );

    await rollBack(CHANGESET_PATH, "--yes");
    await rollBack(savedRollbackChangeset(), "--yes");

    expect(updates).toEqual([
      expect.objectContaining({ name: "Colors", slug: "colors" }),
      expect.objectContaining({ name: "Colors", slug: "colours" }),
    ]);
  });

  it("should recreate a deleted block when the rollback itself is rolled back", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasChangeset(
      makeChangeset([{ type: "component", name: "hero", action: "create", after: { ...comp } }]),
    );
    preconditions.hasRemoteComponents([comp]);
    preconditions.hasRemoteFolders();
    preconditions.hasRemoteDatasources();
    preconditions.hasRemoteTags();
    preconditions.canDeleteComponents();
    const created: { name?: string }[] = [];
    server.use(
      http.post(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`,
        async ({ request }) => {
          const { component } = (await request.json()) as { component: { name?: string } };
          created.push(component);
          return HttpResponse.json({ component: { id: getID(), ...component } });
        },
      ),
    );

    await rollBack(CHANGESET_PATH, "--yes");
    preconditions.hasRemoteComponents([]);
    await rollBack(savedRollbackChangeset(), "--yes");

    expect(created).toEqual([expect.objectContaining({ name: "hero" })]);
  });

  it("should skip a block that no longer exists and save no changeset", async () => {
    preconditions.hasChangeset(
      makeChangeset([
        { type: "component", name: "hero", action: "create", after: { name: "hero" } },
      ]),
    );
    preconditions.hasEmptyRemote();

    await rollBack(CHANGESET_PATH, "--yes");

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("component 'hero'"));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("nothing to roll back"));
    expect(savedChangesets()).toEqual([CHANGESET_PATH]);
  });

  it("should save the rollback changeset when the rollback fails midway", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasChangeset(
      makeChangeset([{ type: "component", name: "hero", action: "create", after: { ...comp } }]),
    );
    preconditions.hasRemoteComponents([comp]);
    preconditions.hasRemoteFolders();
    preconditions.hasRemoteDatasources();
    preconditions.hasRemoteTags();
    preconditions.failsToDeleteComponents();

    await rollBack(CHANGESET_PATH, "--yes");

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Failed to apply rollback"));
    expect(savedRollbackChangeset()).toBeDefined();
  });

  it("should update a deleted block that already exists again instead of creating it", async () => {
    const footer = makeMockComponent({ name: "footer" });
    preconditions.hasChangeset(
      makeChangeset([
        { type: "component", name: "footer", action: "delete", before: { ...footer } },
      ]),
    );
    preconditions.hasRemoteComponents([footer]);
    preconditions.hasRemoteFolders();
    preconditions.hasRemoteDatasources();
    preconditions.hasRemoteTags();
    const updated: string[] = [];
    server.use(
      http.put(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components/:id`,
        ({ params }) => {
          updated.push(String(params.id));
          return HttpResponse.json({ component: footer });
        },
      ),
    );

    await rollBack(CHANGESET_PATH, "--yes");

    expect(updated).toEqual([String(footer.id)]);
  });

  it("should keep a block folder that existed before the rollback when the rollback is rolled back", async () => {
    const oldFolder = { id: 1, uuid: "g-old", name: "Layout", parent_uuid: null };
    const liveFolder = { ...oldFolder, id: 7, uuid: "g-live" };
    const hero = makeMockComponent({ name: "hero" });
    preconditions.hasChangeset(
      makeChangeset([
        { type: "folder", name: "layout", action: "delete", before: oldFolder },
        {
          type: "component",
          name: "hero",
          action: "delete",
          before: { ...hero, component_group_uuid: "g-old" },
        },
      ]),
    );
    preconditions.hasRemoteComponents([]);
    preconditions.hasRemoteFolders([liveFolder]);
    preconditions.hasRemoteDatasources();
    preconditions.hasRemoteTags();
    preconditions.canDeleteComponents();
    const createdComponents: { component_group_uuid?: string }[] = [];
    server.use(
      http.post(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`,
        async ({ request }) => {
          const { component } = (await request.json()) as { component: object };
          createdComponents.push(component);
          return HttpResponse.json({ component: { id: hero.id, ...component } });
        },
      ),
    );
    const deletedFolders: string[] = [];
    server.use(
      http.delete(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/component_groups/:id`,
        ({ params }) => {
          deletedFolders.push(String(params.id));
          return HttpResponse.json({});
        },
      ),
    );

    await rollBack(CHANGESET_PATH, "--yes");
    preconditions.hasRemoteComponents([
      { ...hero, component_group_uuid: "g-live" } as MockComponent,
    ]);
    await rollBack(savedRollbackChangeset(), "--yes");

    expect(createdComponents).toEqual([
      expect.objectContaining({ component_group_uuid: "g-live" }),
    ]);
    expect(deletedFolders).toEqual([]);
  });

  it("should refuse a changeset without the state to restore", async () => {
    preconditions.hasChangeset(
      makeChangeset([
        { type: "component", name: "hero", action: "update", after: { name: "hero" } },
      ]),
    );

    await rollBack(CHANGESET_PATH, "--yes");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("does not record the state to restore for component 'hero'"),
    );
    expect(savedChangesets()).toEqual([CHANGESET_PATH]);
  });

  it("should refuse a changeset recorded for another space", async () => {
    preconditions.hasChangeset(
      makeChangeset(
        [{ type: "component", name: "hero", action: "create", after: { name: "hero" } }],
        {
          spaceId: OTHER_SPACE,
        },
      ),
    );

    await rollBack(CHANGESET_PATH, "--dry-run");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`recorded for space ${OTHER_SPACE}, not space ${DEFAULT_SPACE}`),
    );
  });

  describe("selecting a changeset", () => {
    const heroCreated = makeChangeset([
      { type: "component", name: "hero", action: "create", after: { name: "hero" } },
    ]);
    const newerFiles = {
      [changesetPath("20260411120000")]: makeChangeset([]),
      [changesetPath("20260412120000")]: { ...heroCreated, spaceId: OTHER_SPACE },
      [changesetPath("20260413120000")]: "not json",
    };

    it("should skip changesets without changes, of other spaces, and unreadable ones with --latest", async () => {
      preconditions.hasChangesetFiles({ [CHANGESET_PATH]: heroCreated, ...newerFiles });

      await rollBack("--latest", "--dry-run");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Skipped 20260413120000.json"),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Using latest changeset: 20260410120000.json"),
      );
    });

    it("should offer only changesets of the space that have changes", async () => {
      preconditions.hasChangesetFiles({ [CHANGESET_PATH]: heroCreated, ...newerFiles });
      vi.mocked(select).mockResolvedValue(CHANGESET_PATH);

      await rollBack("--dry-run");

      expect(select).toHaveBeenCalledWith(
        expect.objectContaining({
          choices: [{ name: "20260410120000.json (1 change(s))", value: CHANGESET_PATH }],
        }),
        expect.anything(),
      );
    });

    it("should warn when no changeset has changes for the space", async () => {
      preconditions.hasChangesetFiles(newerFiles);

      await rollBack("--latest");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(`No changesets with changes found for space ${DEFAULT_SPACE}`),
      );
    });
  });

  it("should warn when changeset has no changes", async () => {
    preconditions.hasChangeset(makeChangeset([]));

    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      CHANGESET_PATH,
      "--space",
      DEFAULT_SPACE,
    ]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("nothing to roll back"));
  });

  it("should list changesets and prompt when no file is specified", async () => {
    const comp = makeMockComponent({ name: "hero" });
    const changeset = makeChangeset([
      { type: "component", name: "hero", action: "create", after: { ...comp } },
    ]);
    vol.fromJSON({
      [CHANGESET_PATH]: JSON.stringify(changeset),
    });
    vi.mocked(select).mockResolvedValue(CHANGESET_PATH);
    // dry-run so we don't need remote fetch or confirm
    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      "--space",
      DEFAULT_SPACE,
      "--dry-run",
    ]);

    expect(select).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
  });

  it("should warn when no changesets are found", async () => {
    vol.fromJSON({});

    await schemaCommand.parseAsync(["node", "test", "rollback", "--space", DEFAULT_SPACE]);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("No changesets with changes"),
    );
  });

  it("should skip confirmation prompt with --yes", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasChangeset(
      makeChangeset([{ type: "component", name: "hero", action: "create", after: { ...comp } }]),
    );
    preconditions.hasRemoteComponents([comp]);
    preconditions.hasRemoteFolders();
    preconditions.hasRemoteDatasources();
    preconditions.hasRemoteTags();
    preconditions.canDeleteComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      CHANGESET_PATH,
      "--space",
      DEFAULT_SPACE,
      "--yes",
    ]);

    expect(confirm).not.toHaveBeenCalled();
    // Verify rollback was executed (changeset saved)
    const files = Object.keys(vol.toJSON());
    expect(files.some((f) => f.includes("schema/changesets/") && f !== CHANGESET_PATH)).toBe(true);
  });

  it("should prompt for confirmation without --yes", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasChangeset(
      makeChangeset([{ type: "component", name: "hero", action: "create", after: { ...comp } }]),
    );
    preconditions.confirmsPrompt();
    preconditions.hasRemoteComponents([comp]);
    preconditions.hasRemoteFolders();
    preconditions.hasRemoteDatasources();
    preconditions.hasRemoteTags();
    preconditions.canDeleteComponents();

    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      CHANGESET_PATH,
      "--space",
      DEFAULT_SPACE,
    ]);

    expect(confirm).toHaveBeenCalled();
  });

  it("should auto-select the most recent changeset with --latest", async () => {
    const comp = makeMockComponent({ name: "hero" });
    const changeset = makeChangeset([
      { type: "component", name: "hero", action: "create", after: { ...comp } },
    ]);
    vol.fromJSON({
      [CHANGESET_PATH]: JSON.stringify(changeset),
    });

    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      "--space",
      DEFAULT_SPACE,
      "--latest",
      "--dry-run",
    ]);

    expect(select).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
  });

  it("should warn when --latest is used but no changesets exist", async () => {
    vol.fromJSON({});

    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      "--space",
      DEFAULT_SPACE,
      "--latest",
    ]);

    expect(select).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("No changesets with changes"),
    );
  });

  it("should handle API errors gracefully", async () => {
    const comp = makeMockComponent({ name: "hero" });
    preconditions.hasChangeset(
      makeChangeset([{ type: "component", name: "hero", action: "create", after: { ...comp } }]),
    );
    preconditions.confirmsPrompt();
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/components`, () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );

    await schemaCommand.parseAsync([
      "node",
      "test",
      "rollback",
      CHANGESET_PATH,
      "--space",
      DEFAULT_SPACE,
    ]);

    expect(console.error).toHaveBeenCalled();
  });
});
