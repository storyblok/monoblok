import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
import type { StoryInverse } from "@storyblok/schema/migrations";

import "../index";
import { migrationsCommand } from "../command";
import { DEFAULT_SPACE } from "../../__tests__/helpers";
import { getUI } from "../../../lib/ui";
import { session } from "../../../session";
import { loggedOutSessionState } from "../../../../test/setup";
import { getProgram } from "../../../program";
import { resolveJournal } from "../content-journal";

const server = setupServer();

type RemoteStory = {
  id: number;
  name: string;
  slug: string;
  full_slug: string;
  content: Record<string, unknown>;
};

/** The space as the API holds it: a write changes what a later read returns. */
let space: Map<number, RemoteStory>;
const updates: { id: number; content: Record<string, unknown> }[] = [];

const storyWithHeadline = (headline: string): RemoteStory => ({
  id: 1,
  name: "Home",
  slug: "home",
  full_slug: "home",
  content: {
    _uid: "root",
    component: "page",
    body: [{ _uid: "card-1", component: "card", headline }],
  },
});

/** Puts `title` back where the migration wrote `headline`. */
const renameBack = (expected: string): StoryInverse[] => [
  {
    story: "1",
    patches: [
      {
        uid: "card-1",
        component: "card",
        ops: [
          { kind: "set", key: "title", value: "Hi" },
          { kind: "unset", key: "headline", expect: expected },
        ],
      },
    ],
  },
];

const preconditions = {
  hasRecordedRun(id: string, inverse: StoryInverse[], overrides: Record<string, unknown> = {}) {
    return resolveJournal({ path: undefined }).record(
      {
        id,
        space: DEFAULT_SPACE,
        migration: "0001-rename",
        appliedAt: "2026-09-23T10:00:00.000Z",
        stories: inverse.length,
        blocks: 1,
        ...overrides,
      },
      inverse,
    );
  },
  hasStories(stories: RemoteStory[]) {
    space = new Map(stories.map((story) => [story.id, story]));
    server.use(
      http.get(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/:id`,
        ({ params }) => {
          const story = space.get(Number(params.id));
          return story
            ? HttpResponse.json({ story })
            : HttpResponse.json({ error: "Not Found" }, { status: 404 });
        },
      ),
    );
  },
  canUpdateStories() {
    server.use(
      http.put(
        `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/:id`,
        async ({ request, params }) => {
          const body = (await request.json()) as { story: { content: Record<string, unknown> } };
          updates.push({ id: Number(params.id), content: body.story.content });
          return HttpResponse.json({ story: { id: Number(params.id), ...body.story } });
        },
      ),
    );
  },
};

const undo = (...args: string[]): Promise<unknown> =>
  migrationsCommand.parseAsync(["node", "test", "undo", ...args, "--space", DEFAULT_SPACE]);

describe("migrations undo command", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  beforeEach(() => {
    updates.length = 0;
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vol.reset();
    getProgram().setOptionValueWithSource("path", undefined, "default");
  });

  it("should write back the content the recorded run replaced", async () => {
    await preconditions.hasRecordedRun("2026-09-23T10-00-00-000Z-0001-rename", renameBack("Hi"));
    preconditions.hasStories([storyWithHeadline("Hi")]);
    preconditions.canUpdateStories();

    await undo("--run", "2026-09-23T10-00-00-000Z-0001-rename");

    expect(updates).toEqual([
      {
        id: 1,
        content: expect.objectContaining({
          body: [{ _uid: "card-1", component: "card", title: "Hi" }],
        }),
      },
    ]);
  });

  it("should undo the most recent recorded run when none is named", async () => {
    await preconditions.hasRecordedRun("2026-09-23T10-00-00-000Z-0001-rename", []);
    await preconditions.hasRecordedRun("2026-09-23T11-00-00-000Z-0002-rename", renameBack("Hi"));
    preconditions.hasStories([storyWithHeadline("Hi")]);
    preconditions.canUpdateStories();
    const info = vi.spyOn(getUI(), "info");

    await undo();

    expect(updates).toHaveLength(1);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("2026-09-23T11-00-00-000Z-0002-rename"),
    );
  });

  it("should report a run id the journal does not hold rather than claim an undo", async () => {
    await preconditions.hasRecordedRun("2026-09-23T10-00-00-000Z-0001-rename", renameBack("Hi"));
    preconditions.hasStories([storyWithHeadline("Hi")]);
    const errorSpy = vi.spyOn(console, "error");

    await undo("--run", "no-such-run");

    expect(updates).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("No recorded run"));
  });

  it("should not write back a story an editor changed since the run, and warn about it", async () => {
    await preconditions.hasRecordedRun("2026-09-23T10-00-00-000Z-0001-rename", renameBack("Hi"));
    preconditions.hasStories([storyWithHeadline("edited since")]);
    preconditions.canUpdateStories();
    const warn = vi.spyOn(getUI(), "warn");
    const info = vi.spyOn(getUI(), "info");

    await undo("--run", "2026-09-23T10-00-00-000Z-0001-rename");

    expect(updates).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("changed since the migration ran"));
    expect(info).toHaveBeenCalledWith(expect.stringContaining("Undid 0 stories"));
  });

  it("should not write back a story whose recorded blocks it can no longer find", async () => {
    await preconditions.hasRecordedRun("2026-09-23T10-00-00-000Z-0001-rename", [
      {
        story: "1",
        patches: [
          {
            uid: "renumbered",
            component: "card",
            ops: [{ kind: "set", key: "title", value: "Hi" }],
          },
        ],
      },
    ]);
    preconditions.hasStories([storyWithHeadline("Hi")]);
    preconditions.canUpdateStories();
    const warn = vi.spyOn(getUI(), "warn");

    await undo("--run", "2026-09-23T10-00-00-000Z-0001-rename");

    expect(updates).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no longer in this story"));
  });

  it("should report when the space has no recorded runs", async () => {
    const errorSpy = vi.spyOn(console, "error");

    await undo();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("No migration runs recorded"));
  });

  it("should handle not logged in error", async () => {
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
    const errorSpy = vi.spyOn(console, "error");

    await undo();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("You are currently not logged in"),
    );
  });

  it("should handle missing space error", async () => {
    const errorSpy = vi.spyOn(console, "error");

    await migrationsCommand.parseAsync(["node", "test", "undo"]);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Please provide the space as argument --space YOUR_SPACE_ID."),
    );
  });
});
