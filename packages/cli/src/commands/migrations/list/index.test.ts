import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { defineMigration, renameBlock, renameField } from "@storyblok/schema";
import "../index";
import { migrationsCommand } from "../command";
import { DEFAULT_SPACE } from "../../__tests__/helpers";
import { getUI } from "../../../lib/ui";
import { createRemoteSpace, storyWithCard } from "../__tests__/content-migrations";

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

describe("migrations list command", () => {
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
    space.hasStories(storyWithCard());
  });

  const listed = async (...args: string[]): Promise<string[]> => {
    const info = vi.spyOn(getUI(), "info");
    await run("list", ...args);
    return info.mock.calls.map(([message]) => String(message));
  };

  /** What `--pending` writes to stdout, and whether it wrote anything else. */
  const listedPending = async (): Promise<{ stdout: string; otherOutput: boolean }> => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const console_ = [
      vi.spyOn(console, "log"),
      vi.spyOn(console, "info"),
      vi.spyOn(console, "error"),
    ];
    await run("list", "--pending");
    return {
      stdout: write.mock.calls.map(([chunk]) => String(chunk)).join(""),
      otherOutput: console_.some((spy) => spy.mock.calls.length > 0),
    };
  };

  it("should list migrations that have no recorded run as pending after the runs", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    await run("run");
    space.hasMigrations(["0002-rename-card-to-teaser", renameCardToTeaser]);

    expect(await listed()).toEqual([
      expect.stringMatching(/0001-rename-card-title {2}1 story/),
      "Pending on this machine: 0002-rename-card-to-teaser",
    ]);
  });

  it("should name the migration of a run without a title once, since the run id ends with it", async () => {
    space.hasMigrations(["0001-rename-hero-subtitle", renameHeroSubtitle]);
    await run("run");

    const [line] = await listed();

    expect(line).toMatch(
      /^\S+-0001-rename-hero-subtitle {2}0 stories, 0 blocks {2}\(nothing to roll back\)$/,
    );
  });

  it("should show the title of a run", async () => {
    space.hasMigrations([
      "0001-rename-card-title",
      defineMigration({
        title: "Rename the card title",
        ops: [renameField({ block: "card", field: "title", to: "headline" })],
      }),
    ]);
    await run("run");

    const [line] = await listed();

    expect(line).toMatch(
      /^\S+-0001-rename-card-title {2}Rename the card title {2}1 story, 1 block$/,
    );
  });

  it("should list a rolled back migration as pending again", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    await run("run");
    await run("rollback");

    expect((await listedPending()).stdout).toBe("0001-rename-card-title\n");
  });

  it("should print only the pending migration ids, one per line on stdout, with --pending", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    await run("run");
    space.hasMigrations(
      ["0002-rename-card-to-teaser", renameCardToTeaser],
      ["0003-rename-card-title-again", renameCardTitle],
    );

    expect(await listedPending()).toEqual({
      stdout: "0002-rename-card-to-teaser\n0003-rename-card-title-again\n",
      otherOutput: false,
    });
  });

  it("should not list a .js migration function whose name looks like a content migration", async () => {
    space.hasMigrationFunction("3-article.js", (block) => block);
    space.hasMigrations(["0004-rename-card-title", renameCardTitle]);

    expect(await listed()).toEqual([
      "No migration runs recorded for this space.",
      "Pending on this machine: 0004-rename-card-title",
    ]);
  });

  it("should print nothing with --pending once every migration ran", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    await run("run");

    expect(await listedPending()).toEqual({ stdout: "", otherOutput: false });
  });
});
