import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { defineMigration, renameBlock, renameField } from "@storyblok/schema/migrations";
import "../index";
import { migrationsCommand } from "../command";
import { DEFAULT_SPACE } from "../../__tests__/helpers";
import { getUI } from "../../../lib/ui";
import {
  createRemoteSpace,
  journalEntries,
  type RemoteStory,
  storyWithCard,
} from "../__tests__/content-migrations";

vi.mock("../../../utils/user-module", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/user-module")>()),
  importUserModuleDefault: vi.fn(),
}));

const server = setupServer();

const run = (command: string, ...args: string[]): Promise<unknown> =>
  migrationsCommand.parseAsync(["node", "test", command, ...args, "--space", DEFAULT_SPACE]);

const renameCardTitle = defineMigration([
  renameField({ block: "card", field: "title", to: "headline" }),
]);
const renameCardToTeaser = defineMigration([renameBlock({ block: "card", to: "teaser" })]);
const renameHeroSubtitle = defineMigration([
  renameField({ block: "hero", field: "subtitle", to: "tagline" }),
]);

const cardOf = (story: RemoteStory | undefined) =>
  (story?.content.body as Record<string, unknown>[] | undefined)?.[0];

describe("migrations undo command", () => {
  let space: ReturnType<typeof createRemoteSpace>;

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });
  afterAll(() => server.close());

  beforeEach(() => {
    space = createRemoteSpace(server);
    space.hasReleases();
    space.canUpdateStories();
  });

  it("should restore the content the most recent run changed and name the run first", async () => {
    const info = vi.spyOn(getUI(), "info");
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      ["0002-rename-card-to-teaser", renameCardToTeaser],
    );
    space.hasStories(storyWithCard());
    await run("apply");
    info.mockClear();

    await run("undo");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", headline: "Hi" });
    expect(info.mock.calls[0]?.[0]).toMatch(
      /^Undoing the most recent run .*0002-rename-card-to-teaser/,
    );
  });

  it("should undo the run named with --run while a later run changed other blocks", async () => {
    const story = storyWithCard();
    story.content.body = [
      { _uid: "card-1", component: "card", title: "Hi" },
      { _uid: "hero-1", component: "hero", subtitle: "Welcome" },
    ];
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      ["0002-rename-hero-subtitle", renameHeroSubtitle],
    );
    space.hasStories(story);
    await run("apply");
    const [first] = journalEntries();

    await run("undo", "--run", String(first.id));

    expect(space.story(1)?.content.body).toEqual([
      { _uid: "card-1", component: "card", title: "Hi" },
      { _uid: "hero-1", component: "hero", tagline: "Welcome" },
    ]);
  });

  it("should refuse to undo a run while a later run that changed the same blocks is applied", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      ["0002-rename-card-to-teaser", renameCardToTeaser],
    );
    space.hasStories(storyWithCard());
    await run("apply");
    const [first, second] = journalEntries();
    space.writes.length = 0;

    await run("undo", "--run", String(first.id));

    expect(space.writes).toEqual([]);
    expect(process.exitCode).toBe(2);
    expect(error.mock.calls.flat().join("\n")).toContain(
      `Undo them first, newest first:\n  - ${second.id}`,
    );
  });

  it("should undo an earlier run once the later run that changed the same blocks is undone", async () => {
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      ["0002-rename-card-to-teaser", renameCardToTeaser],
    );
    space.hasStories(storyWithCard());
    await run("apply");
    const [first, second] = journalEntries();

    await run("undo", "--run", String(second.id));
    await run("undo", "--run", String(first.id));

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
  });

  it("should fail for a run that is not recorded", async () => {
    await run("undo", "--run", "2026-01-01T00-00-00-000Z-0001-unknown");

    expect(space.writes).toEqual([]);
    expect(process.exitCode).toBe(2);
  });

  it("should fail when no run is recorded for the space", async () => {
    await run("undo");

    expect(process.exitCode).toBe(2);
  });

  it("should leave a block edited since the run as it is", async () => {
    const warn = vi.spyOn(getUI(), "warn");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    await run("apply");
    space.editsStory(1, (content) => {
      (content.body as Record<string, unknown>[])[0].headline = "Edited";
    });
    space.writes.length = 0;

    await run("undo");

    expect(space.writes).toEqual([]);
    expect(cardOf(space.story(1))).toEqual({
      _uid: "card-1",
      component: "card",
      headline: "Edited",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "1 block was edited since the run and is left as it is: card card-1 (headline). Pass --force to overwrite.",
      ),
    );
  });

  it("should overwrite a block edited since the run with --force, after saying so", async () => {
    const warn = vi.spyOn(getUI(), "warn");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    await run("apply");
    space.editsStory(1, (content) => {
      (content.body as Record<string, unknown>[])[0].headline = "Edited";
    });
    space.writes.length = 0;

    await run("undo", "--force");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "1 block was edited since the run and will be overwritten: card card-1 (headline)",
      ),
    );
  });

  it("should tell restored stories apart from stories kept as edited or with nothing left to undo", async () => {
    const info = vi.spyOn(getUI(), "info");
    const twoCards = storyWithCard({ id: 2, slug: "about", full_slug: "about" });
    twoCards.content.body = [
      { _uid: "card-2", component: "card", title: "Hi" },
      { _uid: "card-3", component: "card", title: "Hi" },
    ];
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(
      storyWithCard(),
      twoCards,
      storyWithCard({ id: 3, slug: "contact", full_slug: "contact" }),
    );
    await run("apply");
    const editHeadline = (content: Record<string, unknown>) => {
      (content.body as Record<string, unknown>[])[0].headline = "Edited";
    };
    space.editsStory(1, editHeadline);
    space.editsStory(2, editHeadline);

    await run("undo");

    expect(info).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Undid 2 stories \(1 partly\) of run .*; 1 story kept as edited\.$/),
    );

    await run("undo", "--force");

    expect(info).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Undid 2 stories of run .*; 1 story had nothing left to undo\.$/),
    );
  });

  it("should undo the earlier run on a second undo and list the runs as undone", async () => {
    const info = vi.spyOn(getUI(), "info");
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      ["0002-rename-card-to-teaser", renameCardToTeaser],
    );
    space.hasStories(storyWithCard());
    await run("apply");

    await run("undo");
    await run("undo");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
    info.mockClear();
    await run("list");
    expect(info.mock.calls.map(([message]) => message)).toEqual([
      expect.stringMatching(/0001-rename-card-title .*\(undone /),
      expect.stringMatching(/0002-rename-card-to-teaser .*\(undone /),
    ]);

    await run("undo");
    expect(process.exitCode).toBe(2);
  });

  it("should keep a run with blocks left in place open, so undo --force reaches them", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    await run("apply");
    space.editsStory(1, (content) => {
      (content.body as Record<string, unknown>[])[0].headline = "Edited";
    });

    await run("undo");
    await run("undo", "--force");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
  });

  it("should fail, count the story as failed, and keep the run open when a write fails", async () => {
    const info = vi.spyOn(getUI(), "info");
    const warn = vi.spyOn(getUI(), "warn");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    await run("apply", "--publish", "all");
    space.failsToUpdateStories();

    await run("undo");

    expect(process.exitCode).toBe(2);
    expect(info).toHaveBeenCalledWith(
      expect.stringMatching(/Undid 0 stories .*; 1 story failed\.$/),
    );
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("for the first time"));
    expect(journalEntries()).toEqual([
      expect.not.objectContaining({ undoneAt: expect.anything() }),
    ]);
  });

  it.each([
    ["deleted", (space: ReturnType<typeof createRemoteSpace>) => space.deletesStory(2)],
    ["moved to the trash", (space: ReturnType<typeof createRemoteSpace>) => space.trashesStory(2)],
  ])("should undo the other stories when one was %s since the run", async (_, remove) => {
    const warn = vi.spyOn(getUI(), "warn");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard(), storyWithCard({ id: 2, slug: "about", full_slug: "about" }));
    await run("apply");
    remove(space);

    await run("undo");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
    expect(warn).toHaveBeenCalledWith(
      "1 story was deleted since the run, so there is nothing to undo there: 2",
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("should refuse while a release is pending unless --allow-pending-releases is passed", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    await run("apply");
    space.hasReleases({ id: 7, name: "Summer campaign", released: false });
    space.writes.length = 0;

    await run("undo");

    expect(space.writes).toEqual([]);
    expect(process.exitCode).toBe(2);

    process.exitCode = undefined;
    await run("undo", "--allow-pending-releases");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
  });

  describe("publishing", () => {
    const publishedStory = () => storyWithCard({ published: true, unpublished_changes: false });

    it("should republish a story the run published", async () => {
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(publishedStory());
      await run("apply", "--publish", "published");
      space.writes.length = 0;

      await run("undo");

      expect(space.writes).toMatchObject([{ id: 1, publish: true }]);
    });

    it("should restore only the draft of a story edited since the run published it", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(publishedStory());
      await run("apply", "--publish", "published");
      space.editsStory(1, (content) => {
        content.seo = "Edited";
      });
      space.writes.length = 0;

      await run("undo");

      expect(space.writes).toMatchObject([{ id: 1, publish: false }]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("only the draft was restored: home"),
      );
    });

    it("should report a story the run published for the first time", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      await run("apply", "--publish", "all");
      space.writes.length = 0;

      await run("undo");

      expect(space.writes).toMatchObject([{ id: 1, publish: false }]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("for the first time"));
    });
  });
});
