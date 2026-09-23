import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
import { defineMigration, renameField } from "@storyblok/schema/migrations";

import "../index";
import { migrationsCommand } from "../command";
import { DEFAULT_SPACE } from "../../__tests__/helpers";
import { loadMigrations } from "../load-migrations";

// Discovery hands real file paths to jiti, which cannot read the memfs volume
// the global setup installs. The migration itself is supplied directly, so the
// command is exercised against the real engine without a real file on disk.
vi.mock("../load-migrations", () => ({ loadMigrations: vi.fn() }));

const server = setupServer();

const storyWithCard = {
  id: 1,
  name: "Home",
  slug: "home",
  full_slug: "home",
  content: {
    _uid: "root",
    component: "page",
    body: [{ _uid: "card-1", component: "card", title: "Hi" }],
  },
};

const updates: { id: number; content: Record<string, unknown> }[] = [];

const preconditions = {
  hasMigration(id: string, migration: ReturnType<typeof defineMigration>) {
    vi.mocked(loadMigrations).mockResolvedValue([{ id, file: `/migrations/${id}.ts`, migration }]);
  },
  hasStoryContainingCard(story: typeof storyWithCard) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, () =>
        HttpResponse.json(
          {
            stories: [
              { id: story.id, name: story.name, slug: story.slug, full_slug: story.full_slug },
            ],
          },
          { headers: { Total: "1", "Per-Page": "100" } },
        ),
      ),
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/${story.id}`, () =>
        HttpResponse.json({ story }),
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
  failsToUpdateStories() {
    server.use(
      http.put(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories/:id`, () =>
        HttpResponse.json({ error: "Unprocessable Entity" }, { status: 422 }),
      ),
    );
  },
};

const journalFiles = (): string[] =>
  Object.keys(vol.toJSON()).filter((file) => file.includes(`migrations/${DEFAULT_SPACE}`));

const readJournalFile = (file: string | undefined): unknown =>
  JSON.parse(String(vol.toJSON()[file ?? ""]));

describe("migrations apply command", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  beforeEach(() => {
    updates.length = 0;
    vi.mocked(loadMigrations).mockReset();
  });

  const renameCardTitle = defineMigration([
    renameField({ block: "card", field: "title", to: "headline" }),
  ]);

  it("should write the migrated content of every story the migration changed", async () => {
    preconditions.hasMigration("0001-rename-card-title", renameCardTitle);
    preconditions.hasStoryContainingCard(storyWithCard);
    preconditions.canUpdateStories();

    await migrationsCommand.parseAsync(["node", "test", "apply", "--space", DEFAULT_SPACE]);

    expect(updates).toEqual([
      {
        id: 1,
        content: expect.objectContaining({
          body: [{ _uid: "card-1", component: "card", headline: "Hi" }],
        }),
      },
    ]);
  });

  it("should record the run so it can be undone", async () => {
    preconditions.hasMigration("0001-rename-card-title", renameCardTitle);
    preconditions.hasStoryContainingCard(storyWithCard);
    preconditions.canUpdateStories();

    await migrationsCommand.parseAsync(["node", "test", "apply", "--space", DEFAULT_SPACE]);

    const recorded = journalFiles();
    const entry = recorded.find(
      (file) => file.endsWith(".json") && !file.endsWith(".patches.json"),
    );
    expect(entry).toBeDefined();
    expect(readJournalFile(entry)).toMatchObject({
      space: DEFAULT_SPACE,
      migration: "0001-rename-card-title",
      stories: 1,
      blocks: 1,
    });
    const patches = recorded.find((file) => file.endsWith(".patches.json"));
    expect(readJournalFile(patches)).toMatchObject([{ story: "1" }]);
  });

  it("should neither write nor record anything on a dry run", async () => {
    preconditions.hasMigration("0001-rename-card-title", renameCardTitle);
    preconditions.hasStoryContainingCard(storyWithCard);
    preconditions.canUpdateStories();

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "apply",
      "--space",
      DEFAULT_SPACE,
      "--dry-run",
    ]);

    expect(updates).toEqual([]);
    expect(journalFiles()).toEqual([]);
  });

  it("should refuse a story that already contains repeated block ids", async () => {
    preconditions.hasMigration("0001-rename-card-title", renameCardTitle);
    preconditions.hasStoryContainingCard({
      ...storyWithCard,
      content: {
        _uid: "root",
        component: "page",
        body: [
          { _uid: "dup", component: "card", title: "one" },
          { _uid: "dup", component: "card", title: "two" },
        ],
      },
    });
    preconditions.canUpdateStories();

    await migrationsCommand.parseAsync(["node", "test", "apply", "--space", DEFAULT_SPACE]);

    expect(updates).toEqual([]);
    // The run still completed; it just changed nothing.
    const entry = journalFiles().find(
      (file) => file.endsWith(".json") && !file.endsWith(".patches.json"),
    );
    expect(readJournalFile(entry)).toMatchObject({ stories: 0 });
  });

  it("should record only the stories it managed to write", async () => {
    preconditions.hasMigration("0001-rename-card-title", renameCardTitle);
    preconditions.hasStoryContainingCard(storyWithCard);
    preconditions.failsToUpdateStories();

    await migrationsCommand.parseAsync(["node", "test", "apply", "--space", DEFAULT_SPACE]);

    const entry = journalFiles().find(
      (file) => file.endsWith(".json") && !file.endsWith(".patches.json"),
    );
    expect(readJournalFile(entry)).toMatchObject({ stories: 0, blocks: 0 });
    const patches = journalFiles().find((file) => file.endsWith(".patches.json"));
    expect(readJournalFile(patches)).toEqual([]);
  });

  it("should report that there is nothing to apply when no migration matches the name", async () => {
    preconditions.hasMigration("0001-rename-card-title", renameCardTitle);

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "apply",
      "0002-other",
      "--space",
      DEFAULT_SPACE,
    ]);

    expect(updates).toEqual([]);
    expect(process.exitCode).toBe(2);
  });
});
