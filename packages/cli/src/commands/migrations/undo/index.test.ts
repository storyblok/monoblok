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

  it("should undo the run named with --run", async () => {
    space.hasMigrations(
      ["0001-rename-card-title", renameCardTitle],
      ["0002-rename-card-to-teaser", renameCardToTeaser],
    );
    space.hasStories(storyWithCard());
    await run("apply");
    const [first] = journalEntries();

    await run("undo", "--run", String(first.id));

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "teaser", title: "Hi" });
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
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Pass --force to overwrite"));
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
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("will be overwritten"));
  });

  it("should undo the other stories when one was deleted since the run", async () => {
    const warn = vi.spyOn(getUI(), "warn");
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    space.hasStories(storyWithCard(), storyWithCard({ id: 2, slug: "about", full_slug: "about" }));
    await run("apply");
    space.deletesStory(2);

    await run("undo");

    expect(cardOf(space.story(1))).toEqual({ _uid: "card-1", component: "card", title: "Hi" });
    expect(warn).toHaveBeenCalledWith("Story 2 could not be read, so it was not undone.");
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
