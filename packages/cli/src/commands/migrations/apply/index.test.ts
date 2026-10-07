import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
import { defineBlock, defineField } from "@storyblok/schema";
import { defineMigration, renameBlock, renameField } from "@storyblok/schema/migrations";
import "../index";
import { migrationsCommand } from "../command";
import { DEFAULT_SPACE } from "../../__tests__/helpers";
import { getUI } from "../../../lib/ui";
import { session } from "../../../session";
import { loggedInSessionState, loggedOutSessionState } from "../../../../test/setup";
import {
  createRemoteSpace,
  journalEntries,
  MIGRATIONS_DIRECTORY,
  storyWithCard,
} from "../__tests__/content-migrations";

vi.mock("../../../utils/user-module", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/user-module")>()),
  importUserModuleDefault: vi.fn(),
}));

let schemaModule: Record<string, unknown> = {};
vi.mock("../../../utils/schema/classify-exports", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/schema/classify-exports")>()),
  loadSchemaModule: async () => schemaModule,
}));

const server = setupServer();

const apply = (...args: string[]): Promise<unknown> =>
  migrationsCommand.parseAsync(["node", "test", "apply", ...args, "--space", DEFAULT_SPACE]);

const renameCardTitle = defineMigration([
  renameField({ block: "card", field: "title", to: "headline" }),
]);
const renameCardToTeaser = defineMigration([renameBlock({ block: "card", to: "teaser" })]);
const renameTeaserTitle = defineMigration([
  renameField({ block: "teaser", field: "title", to: "headline" }),
]);

const storyWithRepeatedIds = (id = 1) =>
  storyWithCard({
    id,
    slug: `repeated-${id}`,
    full_slug: `repeated-${id}`,
    content: {
      _uid: `root-${id}`,
      component: "page",
      body: [
        { _uid: "dup", component: "card", title: "one" },
        { _uid: "dup", component: "card", title: "two" },
      ],
    },
  });

describe("migrations apply command", () => {
  let space: ReturnType<typeof createRemoteSpace>;

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });
  afterAll(() => server.close());

  beforeEach(() => {
    schemaModule = {};
    space = createRemoteSpace(server);
    space.hasReleases();
  });

  it("should write the migrated content of every story the migration changed", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply();

    expect(space.writes).toEqual([
      {
        id: 1,
        content: expect.objectContaining({
          body: [{ _uid: "card-1", component: "card", headline: "Hi" }],
        }),
        publish: false,
      },
    ]);
  });

  it("should apply migrations in the order of their numeric prefix", async () => {
    space.hasMigrations(
      ["10-rename-teaser-title", renameTeaserTitle],
      ["9-rename-card-to-teaser", renameCardToTeaser],
    );
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply();

    expect(space.story(1)?.content.body).toEqual([
      { _uid: "card-1", component: "teaser", headline: "Hi" },
    ]);
  });

  it("should apply only the named migration", async () => {
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      ["0002-rename-card-to-teaser", renameCardToTeaser],
    );
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply("0002-rename-card-to-teaser");

    expect(space.story(1)?.content.body).toEqual([
      { _uid: "card-1", component: "teaser", title: "Hi" },
    ]);
  });

  it("should fail when no migration has the given name and name the ones there are", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());

    await apply("0002-other");

    expect(space.writes).toEqual([]);
    expect(process.exitCode).toBe(2);
    expect(error.mock.calls.flat().join("\n")).toContain("Available: 0001-rename-card-title.");
  });

  it("should accept the migration's filename as its name", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply("0001-rename-card-title.ts");

    expect(space.writes).toHaveLength(1);
  });

  it("should apply the named migration when another migration file is broken", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    vol.fromJSON({ [`${MIGRATIONS_DIRECTORY}/0002-broken.ts`]: "export default 42;" });
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply("0001-rename-card-title");

    expect(space.writes).toHaveLength(1);
    expect(process.exitCode).toBeUndefined();
  });

  it("should not load schema snapshots that sit beside the migrations", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    vol.fromJSON({ [`${MIGRATIONS_DIRECTORY}/0001-rename-card-title.before.ts`]: "" });
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply();

    expect(space.writes).toHaveLength(1);
    expect(process.exitCode).toBeUndefined();
  });

  it("should record the run so it can be listed and undone", async () => {
    const info = vi.spyOn(getUI(), "info");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply();
    await migrationsCommand.parseAsync(["node", "test", "list", "--space", DEFAULT_SPACE]);

    expect(journalEntries()).toMatchObject([
      { space: DEFAULT_SPACE, migration: "0001-rename-card-title", stories: 1, blocks: 1 },
    ]);
    expect(info).toHaveBeenLastCalledWith(
      expect.stringMatching(
        /-0001-rename-card-title {2}0001-rename-card-title {2}1 story, 1 block$/,
      ),
    );
  });

  it("should list the recorded runs without a login", async () => {
    const info = vi.spyOn(getUI(), "info");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories();
    await apply();
    session().state = loggedOutSessionState();

    try {
      await migrationsCommand.parseAsync(["node", "test", "list", "--space", DEFAULT_SPACE]);
    } finally {
      session().state = loggedInSessionState();
    }

    expect(process.exitCode).toBeUndefined();
    expect(info).toHaveBeenLastCalledWith(expect.stringContaining("0001-rename-card-title"));
  });

  it("should neither write nor record anything on a dry run", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());

    await apply("--dry-run");

    expect(space.writes).toEqual([]);
    expect(journalEntries()).toEqual([]);
  });

  it("should report under a dry run what a real run does, including for a migration that matches only what an earlier one produced", async () => {
    const info = vi.spyOn(getUI(), "info");
    const list = vi.spyOn(getUI(), "list");
    space.hasMigrations(
      ["0001-rename-card-to-teaser", renameCardToTeaser],
      ["0002-rename-teaser-title", renameTeaserTitle],
    );
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply("--dry-run");

    expect(info.mock.calls.map(([message]) => message)).toEqual([
      "0001-rename-card-to-teaser: would change 1 story (1 block).",
      "0002-rename-teaser-title: would change 1 story (1 block).",
    ]);
    expect(list).toHaveBeenCalledWith(["home: 1 block"]);

    await apply();

    expect(space.writes).toHaveLength(2);
  });

  it("should refuse a story that already contains repeated block ids and fail when nothing was written", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithRepeatedIds());
    space.canUpdateStories();

    await apply();

    expect(space.writes).toEqual([]);
    expect(journalEntries()).toEqual([]);
    expect(process.exitCode).toBe(2);
  });

  it("should succeed and record the stories it wrote when it refused others", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard(), storyWithRepeatedIds(2));
    space.canUpdateStories();

    await apply();

    expect(space.writes.map((write) => write.id)).toEqual([1]);
    expect(journalEntries()).toMatchObject([{ stories: 1 }]);
    expect(process.exitCode).toBeUndefined();
  });

  it("should fail when one of several migrations refused every story it matched", async () => {
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      [
        "0002-rename-hero-title",
        defineMigration([renameField({ block: "hero", field: "title", to: "headline" })]),
      ],
    );
    space.hasStories(
      storyWithRepeatedIds(1),
      storyWithCard({
        id: 2,
        slug: "about",
        full_slug: "about",
        content: {
          _uid: "root-2",
          component: "page",
          body: [{ _uid: "hero-1", component: "hero", title: "Hi" }],
        },
      }),
    );
    space.canUpdateStories();

    await apply();

    expect(space.writes.map((write) => write.id)).toEqual([2]);
    expect(process.exitCode).toBe(2);
  });

  it("should record nothing and fail when every write failed", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.failsToUpdateStories();

    await apply();

    expect(journalEntries()).toEqual([]);
    expect(process.exitCode).toBe(2);
  });

  it("should record the run before the first write, so a run that stops partway can be undone", async () => {
    const recordedAtWrite: number[] = [];
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories(() => recordedAtWrite.push(journalEntries().length));

    await apply();

    expect(recordedAtWrite).toEqual([1]);
  });

  it("should record only the stories that were written when some writes failed, and fail", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard(), storyWithCard({ id: 2, slug: "about", full_slug: "about" }));
    space.canUpdateStories();
    server.use(
      http.put(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/2`, () =>
        HttpResponse.json({ error: "Unprocessable Entity" }, { status: 422 }),
      ),
    );

    await apply();

    expect(journalEntries()).toMatchObject([{ stories: 1 }]);
    expect(process.exitCode).toBe(2);
  });

  it("should migrate the other stories and fail when one story could not be read", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard(), storyWithCard({ id: 2, slug: "about", full_slug: "about" }));
    space.canUpdateStories();
    space.failsToReadStory(1);

    await apply();

    expect(space.writes.map((write) => write.id)).toEqual([2]);
    expect(process.exitCode).toBe(2);
  });

  it("should record nothing for a re-run that changes no story", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.canUpdateStories();

    await apply();
    await apply();

    expect(journalEntries()).toHaveLength(1);
  });

  describe("--schema", () => {
    it("should refuse to check several migrations against one schema", async () => {
      space.hasMigrations(
        ["0001-rename-card-title", renameCardTitle],
        ["0002-rename-card-to-teaser", renameCardToTeaser],
      );
      server.resetHandlers();

      await apply("--schema", "src/schema.ts");

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(2);
    });

    it("should refuse a migration naming a block the schema does not define, before reaching the API", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      schemaModule = {
        page: defineBlock({ name: "page", fields: [defineField("body", { type: "bloks" })] }),
      };
      server.resetHandlers();

      await apply("--schema", "src/schema.ts");

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(2);
      expect(error.mock.calls.flat().join("\n")).toContain(
        "0001-rename-card-title does not match the schema",
      );
    });

    it("should apply a migration the schema defines", async () => {
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.canUpdateStories();
      schemaModule = {
        card: defineBlock({ name: "card", fields: [defineField("title", { type: "text" })] }),
      };

      await apply("--schema", "src/schema.ts");

      expect(space.writes).toHaveLength(1);
    });
  });

  describe("pending releases", () => {
    it("should refuse to run while a release is pending and name it", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.hasReleases(
        { id: 7, name: "Summer campaign", released: false },
        { id: 8, name: "Spring campaign", released: true },
      );
      space.canUpdateStories();

      await apply();

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(2);
      const output = error.mock.calls.flat().join("\n");
      expect(output).toContain("Summer campaign (7)");
      expect(output).not.toContain("Spring campaign");
    });

    it("should run with --allow-pending-releases and list the releases it misses", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.hasReleases({ id: 7, name: "Summer campaign", released: false });
      space.canUpdateStories();

      await apply("--allow-pending-releases");

      expect(space.writes).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Summer campaign (7)"));
    });

    it("should refuse to run when the releases can't be checked", async () => {
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.failsToListReleases();
      space.canUpdateStories();

      await apply();

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(1);
    });

    it("should warn and run with --allow-pending-releases when the releases can't be checked", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.failsToListReleases();
      space.canUpdateStories();

      await apply("--allow-pending-releases");

      expect(space.writes).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Could not check for pending releases"),
      );
    });

    it("should only warn on a dry run", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      space.hasReleases({ id: 7, name: "Summer campaign", released: false });

      await apply("--dry-run");

      expect(process.exitCode).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Summer campaign (7)"));
    });
  });

  describe("publishing", () => {
    const publishedStory = (id: number, unpublishedChanges: boolean) =>
      storyWithCard({
        id,
        slug: `story-${id}`,
        full_slug: `story-${id}`,
        published: true,
        unpublished_changes: unpublishedChanges,
      });

    it("should write drafts only and warn how many published stories that affects", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(publishedStory(1, false), publishedStory(2, true), storyWithCard({ id: 3 }));
      space.canUpdateStories();

      await apply();

      expect(space.writes.some((write) => write.publish)).toBe(false);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("2 published stories were"));
    });

    it("should publish only the stories the --publish mode selects", async () => {
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(publishedStory(1, false), publishedStory(2, true), storyWithCard({ id: 3 }));
      space.canUpdateStories();

      const warn = vi.spyOn(getUI(), "warn");

      await apply("--publish", "published");

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("--publish published doesn't select it"),
      );
      expect(space.writes.map(({ id, publish }) => ({ id, publish }))).toEqual([
        { id: 1, publish: true },
        { id: 2, publish: false },
        { id: 3, publish: false },
      ]);
    });

    it("should reject an unknown --publish mode", async () => {
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());

      await apply("--publish", "everything");

      expect(space.writes).toEqual([]);
      expect(process.exitCode).toBe(2);
    });
  });
});
