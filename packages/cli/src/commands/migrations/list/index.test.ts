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

  it("should list migrations that have no recorded run as pending after the runs", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    await run("run");
    space.hasMigrations(["0002-rename-card-to-teaser", renameCardToTeaser]);

    expect(await listed()).toEqual([
      expect.stringMatching(/0001-rename-card-title {2}1 story/),
      "Pending on this machine: 0002-rename-card-to-teaser",
    ]);
  });

  it("should list an rolled back migration as pending again", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    await run("run");
    await run("rollback");

    expect(await listed("--pending")).toEqual(["0001-rename-card-title"]);
  });

  it("should list only pending migrations with --pending", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    await run("run");
    space.hasMigrations(["0002-rename-card-to-teaser", renameCardToTeaser]);

    expect(await listed("--pending")).toEqual(["0002-rename-card-to-teaser"]);
  });

  it("should say nothing is pending with --pending once every migration ran", async () => {
    space.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    await run("run");

    expect(await listed("--pending")).toEqual([
      "No pending content migrations for this space on this machine.",
    ]);
  });
});
