import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { defineMigration, renameBlock, renameField } from "@storyblok/schema";
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

describe("migrations rollback command for content migration runs", () => {
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
    await run("run");
    info.mockClear();

    await run("rollback");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", headline: "Hi" });
    expect(info.mock.calls[0]?.[0]).toMatch(
      /^Rolling back the most recent run .*0002-rename-card-to-teaser/,
    );
  });

  it("should read each story of the run once, several at a time within a bound", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(
      ...Array.from({ length: 30 }, (_, index) =>
        storyWithCard({ id: index + 1, slug: `story-${index}`, full_slug: `story-${index}` }),
      ),
    );
    await run("run");
    space.forgetReads();
    space.delaysReads(5);

    await run("rollback");

    expect(cardOf(space.story(30))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
    expect([...space.reads].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
    expect(space.maxConcurrentReads()).toBeGreaterThan(1);
    expect(space.maxConcurrentReads()).toBeLessThan(30);
  });

  it("should roll back the named run while a later run changed other blocks", async () => {
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
    await run("run");
    const [first] = journalEntries();

    await run("rollback", String(first.id));

    expect(space.story(1)?.content.body).toEqual([
      { _uid: "card-1", component: "card", title: "Hi" },
      { _uid: "hero-1", component: "hero", tagline: "Welcome" },
    ]);
  });

  it("should refuse to roll back a run while a later run that changed the same blocks is applied", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      ["0002-rename-card-to-teaser", renameCardToTeaser],
    );
    space.hasStories(storyWithCard());
    await run("run");
    const [first, second] = journalEntries();
    space.writes.length = 0;

    await run("rollback", String(first.id));

    expect(space.writes).toEqual([]);
    expect(process.exitCode).toBe(2);
    expect(error.mock.calls.flat().join("\n")).toContain(
      `Roll them back first, newest first:\n  - ${second.id}`,
    );
  });

  it("should roll back an earlier run once the later run that changed the same blocks is rolled back", async () => {
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      ["0002-rename-card-to-teaser", renameCardToTeaser],
    );
    space.hasStories(storyWithCard());
    await run("run");
    const [first, second] = journalEntries();

    await run("rollback", String(second.id));
    await run("rollback", String(first.id));

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
  });

  it("should fail for a run that is not recorded", async () => {
    await run("rollback", "2026-01-01T00-00-00-000Z-0001-unknown");

    expect(space.writes).toEqual([]);
    expect(process.exitCode).toBe(2);
  });

  it("should fail when no run is recorded for the space", async () => {
    await run("rollback");

    expect(process.exitCode).toBe(2);
  });

  it("should leave a block edited since the run as it is", async () => {
    const warn = vi.spyOn(getUI(), "warn");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    await run("run");
    space.editsStory(1, (content) => {
      (content.body as Record<string, unknown>[])[0].headline = "Edited";
    });
    space.writes.length = 0;

    await run("rollback");

    expect(space.writes).toEqual([]);
    expect(cardOf(space.story(1))).toEqual({
      _uid: "card-1",
      component: "card",
      headline: "Edited",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "1 block was changed since the run and is left as it is: card card-1 (headline). Pass --force to overwrite.",
      ),
    );
  });

  it("should overwrite a block edited since the run with --force, after saying so", async () => {
    const warn = vi.spyOn(getUI(), "warn");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    await run("run");
    space.editsStory(1, (content) => {
      (content.body as Record<string, unknown>[])[0].headline = "Edited";
    });
    space.writes.length = 0;

    await run("rollback", "--force");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "1 block was changed since the run and will be overwritten: card card-1 (headline)",
      ),
    );
  });

  it("should tell restored stories apart from stories left as changed or with nothing left to undo", async () => {
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
    await run("run");
    const editHeadline = (content: Record<string, unknown>) => {
      (content.body as Record<string, unknown>[])[0].headline = "Edited";
    };
    space.editsStory(1, editHeadline);
    space.editsStory(2, editHeadline);

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;
    await run("rollback");

    expect(info).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Rolled back 2 stories \(1 partly\) of run .*; 1 story left as changed since the run\.$/,
      ),
    );
    expect(process.exitCode).toBe(2);
    expect(error.mock.calls.flat().join("\n")).toContain("The run is only partly rolled back");
    process.exitCode = undefined;

    await run("rollback", "--force");

    expect(info).toHaveBeenLastCalledWith(
      expect.stringMatching(
        /^Rolled back 2 stories of run .*; 1 story had nothing left to roll back\.$/,
      ),
    );
  });

  it("should roll back the earlier run on a second rollback and list the runs as rolled back", async () => {
    const info = vi.spyOn(getUI(), "info");
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      ["0002-rename-card-to-teaser", renameCardToTeaser],
    );
    space.hasStories(storyWithCard());
    await run("run");

    await run("rollback");
    await run("rollback");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
    info.mockClear();
    await run("list");
    expect(info.mock.calls.map(([message]) => message)).toEqual([
      expect.stringMatching(/0001-rename-card-title .*\(rolled back /),
      expect.stringMatching(/0002-rename-card-to-teaser .*\(rolled back /),
      "Pending on this machine: 0001-rename-card-title, 0002-rename-card-to-teaser",
    ]);

    await run("rollback");
    expect(process.exitCode).toBe(2);
  });

  it("should keep when a run was first rolled back when it is rolled back again", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    await run("run");
    await run("rollback");
    const [undone] = journalEntries();
    vi.useFakeTimers({ now: Date.now() + 60_000, toFake: ["Date"] });

    try {
      await run("rollback", String(undone.id));
    } finally {
      vi.useRealTimers();
    }

    expect(journalEntries()).toEqual([expect.objectContaining({ undoneAt: undone.undoneAt })]);
  });

  it("should keep a run with blocks left in place open, so undo --force reaches them", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    await run("run");
    space.editsStory(1, (content) => {
      (content.body as Record<string, unknown>[])[0].headline = "Edited";
    });

    await run("rollback");
    await run("rollback", "--force");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
  });

  it("should list a run as partly rolled back while blocks are left in place, and as rolled back once they are restored", async () => {
    const info = vi.spyOn(getUI(), "info");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard(), storyWithCard({ id: 2, slug: "about", full_slug: "about" }));
    await run("run");
    space.editsStory(1, (content) => {
      (content.body as Record<string, unknown>[])[0].headline = "Edited";
    });

    await run("rollback");
    info.mockClear();
    await run("list");

    expect(info).toHaveBeenLastCalledWith(expect.stringMatching(/\(partly rolled back [^)]+\)$/));

    await run("rollback", "--force");
    info.mockClear();
    await run("list");

    expect(info).toHaveBeenCalledWith(expect.stringMatching(/ {2}\(rolled back [^)]+\)$/));
  });

  it("should fail, count the story as failed, and keep the run open when a write fails", async () => {
    const info = vi.spyOn(getUI(), "info");
    const warn = vi.spyOn(getUI(), "warn");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    await run("run", "--publish", "all");
    space.failsToUpdateStories();

    await run("rollback");

    expect(process.exitCode).toBe(2);
    expect(info).toHaveBeenCalledWith(
      expect.stringMatching(/Rolled back 0 stories .*; 1 story failed\.$/),
    );
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("for the first time"));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^.*home.* could not be written: /));
    expect(journalEntries()).toEqual([
      expect.not.objectContaining({ undoneAt: expect.anything() }),
    ]);
  });

  it.each([
    ["deleted", (space: ReturnType<typeof createRemoteSpace>) => space.deletesStory(2), "2"],
    [
      "moved to the trash",
      (space: ReturnType<typeof createRemoteSpace>) => space.trashesStory(2),
      "about",
    ],
  ])("should undo the other stories when one was %s since the run", async (_, remove, named) => {
    const warn = vi.spyOn(getUI(), "warn");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard(), storyWithCard({ id: 2, slug: "about", full_slug: "about" }));
    await run("run");
    remove(space);

    await run("rollback");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
    expect(warn).toHaveBeenCalledWith(
      `1 story was deleted since the run, so there is nothing to roll back there: ${named}`,
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("should refuse while a release is pending unless --allow-pending-releases is passed", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    await run("run");
    space.hasReleases({ id: 7, name: "Summer campaign", released: false });
    space.writes.length = 0;

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await run("rollback");

    expect(space.writes).toEqual([]);
    expect(process.exitCode).toBe(2);
    expect(error.mock.calls.flat().join("\n")).toContain(
      "This rollback doesn't restore release content, and deploying the release overwrites the stories it restores",
    );

    process.exitCode = undefined;
    await run("rollback", "--allow-pending-releases");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
  });

  describe("publishing", () => {
    const publishedStory = () => storyWithCard({ published: true, unpublished_changes: false });

    it("should republish a story the run published", async () => {
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(publishedStory());
      await run("run", "--publish", "published");
      space.writes.length = 0;

      await run("rollback");

      expect(space.writes).toMatchObject([{ id: 1, publish: true }]);
    });

    it("should restore only the draft of a story edited since the run published it", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(publishedStory());
      await run("run", "--publish", "published");
      space.editsStory(1, (content) => {
        content.seo = "Edited";
      });
      space.writes.length = 0;

      await run("rollback");

      expect(space.writes).toMatchObject([{ id: 1, publish: false }]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("only the draft was restored: home"),
      );
    });

    it("should keep the run open while a story still publishes migrated content, and say how to finish", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(publishedStory());
      await run("run", "--publish", "published");
      const [recorded] = journalEntries();
      space.failsToPublishStories("The field card.headline can't be blank");
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      await run("rollback");

      expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /home.*: the draft was restored, but publishing it failed: .*can't be blank/,
        ),
      );
      expect(process.exitCode).toBe(2);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining(
          `1 story still publishes the content the run published, because publishing the restored draft failed: home. Push the schema as it was before the run, then run "storyblok migrations rollback ${String(recorded.id)}" again to publish the restored draft.`,
        ),
      );
      const info = vi.spyOn(getUI(), "info");
      await run("list");
      expect(info).toHaveBeenLastCalledWith(expect.stringMatching(/\(partly rolled back [^)]+\)$/));
    });

    it("should publish the restored draft on the next rollback once publishing succeeds, and mark the run rolled back", async () => {
      const info = vi.spyOn(getUI(), "info");
      vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(publishedStory());
      await run("run", "--publish", "published");
      space.failsToPublishStories("The field card.headline can't be blank");
      await run("rollback");
      space.canUpdateStories();
      space.writes.length = 0;
      process.exitCode = undefined;

      await run("rollback");

      expect(space.writes).toEqual([
        {
          id: 1,
          content: expect.objectContaining({
            body: [{ _uid: "card-1", component: "card", title: "Hi" }],
          }),
          publish: true,
        },
      ]);
      expect(process.exitCode).toBeUndefined();
      expect(info).toHaveBeenLastCalledWith(
        expect.stringMatching(
          /^Rolled back 0 stories of run .*; published the restored draft of 1 story\.$/,
        ),
      );
      info.mockClear();
      await run("list");
      expect(info).toHaveBeenCalledWith(expect.stringMatching(/ {2}\(rolled back [^)]+\)$/));
    });

    it("should not publish a restored draft an editor changed after a republish failed", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(publishedStory());
      await run("run", "--publish", "published");
      space.failsToPublishStories("The field card.headline can't be blank");
      await run("rollback");
      space.canUpdateStories();
      space.editsStory(1, (content) => {
        content.seo = "Edited";
      });
      space.writes.length = 0;
      process.exitCode = undefined;

      await run("rollback");

      expect(space.writes).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("only the draft was restored: home"),
      );
      expect(process.exitCode).toBeUndefined();
    });

    it("should roll back a story whose publish failed during the run as a draft only, without publish warnings", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      vi.spyOn(console, "error").mockImplementation(() => {});
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(
        storyWithCard(),
        storyWithCard({ id: 2, slug: "about", full_slug: "about", published: true }),
      );
      space.failsToPublishStories("The field card.headline can't be blank");
      await run("run", "--publish", "all");
      space.canUpdateStories();
      warn.mockClear();
      process.exitCode = undefined;

      await run("rollback");

      expect(space.writes.map(({ id, publish }) => ({ id, publish }))).toEqual([
        { id: 1, publish: false },
        { id: 2, publish: false },
      ]);
      expect(warn).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    });

    it("should report a story the run published for the first time", async () => {
      const warn = vi.spyOn(getUI(), "warn");
      space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
      space.hasStories(storyWithCard());
      await run("run", "--publish", "all");
      space.writes.length = 0;

      await run("rollback");

      expect(space.writes).toMatchObject([{ id: 1, publish: false }]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("for the first time"));
    });
  });
});

describe("migrations rollback command with runs that changed nothing", () => {
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

  it("should roll back the latest run that changed stories, not a later run that changed nothing", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    await run("run");
    space.hasMigrations(["0002-rename-hero-subtitle", renameHeroSubtitle]);
    await run("run");

    await run("rollback");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
  });

  it("should say that no run has changes to roll back when the runs left changed nothing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    space.hasMigrations(["0001-rename-hero-subtitle", renameHeroSubtitle]);
    space.hasStories(storyWithCard());
    await run("run");

    await run("rollback");

    const printed = error.mock.calls.flat().join("\n");
    expect(printed).toContain(
      `No content migration run recorded for space ${DEFAULT_SPACE} has changes left to roll back. The runs not rolled back changed no stories.`,
    );
    expect(printed).not.toContain("already rolled back");
  });

  it("should list a run that changed nothing as having nothing to roll back", async () => {
    const info = vi.spyOn(getUI(), "info");
    space.hasMigrations(["0001-rename-hero-subtitle", renameHeroSubtitle]);
    space.hasStories(storyWithCard());
    await run("run");
    info.mockClear();

    await run("list");

    expect(info.mock.calls.map(([line]) => line)).toEqual([
      expect.stringMatching(
        /0001-rename-hero-subtitle {2}0 stories, 0 blocks {2}\(nothing to roll back\)$/,
      ),
    ]);
  });
});

describe("migrations rollback command for rollback files", () => {
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

  const before = { _uid: "root", component: "page", body: [] };

  it("should restore the stories a rollback file names, with or without its extension", async () => {
    space.hasStories(storyWithCard());
    space.hasRollbackFile("card.1767225600000", { storyId: 1, name: "Home", content: before });

    await run("rollback", "card.1767225600000.jsonl");

    expect(space.story(1)?.content).toEqual(before);
  });

  it("should refuse to restore a rollback file while a release is pending", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    space.hasStories(storyWithCard());
    space.hasRollbackFile("card.1767225600000", { storyId: 1, name: "Home", content: before });
    space.hasReleases({ id: 7, name: "Summer campaign", released: false });

    await run("rollback", "card.1767225600000");

    expect(space.writes).toEqual([]);
  });

  it("should name neither a recorded run nor a rollback file it doesn't find", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await run("rollback", "card.1767225600000");

    expect(process.exitCode).toBe(2);
    expect(error.mock.calls.flat().join("\n")).toContain(
      'No recorded run or rollback file "card.1767225600000"',
    );
  });

  it("should not pick a rollback file as the most recent run", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    space.hasStories(storyWithCard());
    space.hasRollbackFile("card.1767225600000", { storyId: 1, name: "Home", content: before });

    await run("rollback");

    expect(space.writes).toEqual([]);
    expect(error.mock.calls.flat().join("\n")).toContain("Name a rollback file");
  });

  it("should list rollback files beside recorded runs, oldest first", async () => {
    const info = vi.spyOn(getUI(), "info");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard());
    space.hasRollbackFile(
      "card.1767225600000",
      { storyId: 1, name: "Home", content: before },
      { storyId: 2, name: "About", content: before },
    );
    await run("run");
    info.mockClear();

    await run("list");

    expect(info.mock.calls.map(([line]) => line)).toEqual([
      "card.1767225600000  migration functions  2 stories  (rollback file)",
      expect.stringMatching(
        /-0001-rename-card-title {2}0001-rename-card-title {2}1 story, 1 block$/,
      ),
    ]);
  });
});
