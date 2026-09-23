import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
import {
  blockComponents,
  defineMigration,
  renameBlock,
  renameField,
} from "@storyblok/schema/migrations";

import "../index";
import { migrationsCommand } from "../command";
import { DEFAULT_SPACE } from "../../__tests__/helpers";
import { getUI } from "../../../lib/ui";
import { loadMigrations } from "../load-migrations";
import type { LoadedMigration } from "../load-migrations";

// Discovery hands real file paths to jiti, which cannot read the memfs volume
// the global setup installs. The migrations are supplied directly, so the
// command is exercised against the real engine without a real file on disk.
vi.mock("../load-migrations", () => ({ loadMigrations: vi.fn() }));

// The schema entry `--schema` names is loaded through jiti too.
let schemaModule: Record<string, unknown> = {};
vi.mock("jiti", () => ({
  createJiti: () => ({ import: async () => schemaModule }),
}));

const server = setupServer();

type RemoteStory = {
  id: number;
  name: string;
  slug: string;
  full_slug: string;
  content: Record<string, unknown>;
};

const storyWithCard = (): RemoteStory => ({
  id: 1,
  name: "Home",
  slug: "home",
  full_slug: "home",
  content: {
    _uid: "root",
    component: "page",
    body: [{ _uid: "card-1", component: "card", title: "Hi" }],
  },
});

/** The space as the API holds it: a write changes what a later read returns. */
let space: Map<number, RemoteStory>;
const updates: { id: number; content: Record<string, unknown> }[] = [];

const preconditions = {
  hasMigrations(...entries: [id: string, migration: LoadedMigration["migration"]][]) {
    vi.mocked(loadMigrations).mockResolvedValue(
      entries.map(([id, migration]) => ({ id, file: `/migrations/${id}.ts`, migration })),
    );
  },
  hasStories(stories: RemoteStory[]) {
    space = new Map(stories.map((story) => [story.id, story]));
    server.use(
      // `contain_component` is answered from the content the API currently
      // holds, which is what makes a dry run's second migration a real test.
      http.get(`https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}/stories`, ({ request }) => {
        const component = new URL(request.url).searchParams.get("contain_component");
        const matching = [...space.values()].filter(
          (story) => !component || blockComponents(story.content).includes(component),
        );
        return HttpResponse.json(
          {
            stories: matching.map(({ content: _content, ...rest }) => rest),
          },
          { headers: { Total: String(matching.length), "Per-Page": "100" } },
        );
      }),
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
          const id = Number(params.id);
          updates.push({ id, content: body.story.content });
          const story = space.get(id);
          if (story) {
            space.set(id, { ...story, content: body.story.content });
          }
          return HttpResponse.json({ story: { id, ...body.story } });
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
  hasSchemaDefining(blocks: Record<string, unknown>) {
    schemaModule = blocks;
    vol.fromJSON({ "src/schema.ts": "export const block = {};" });
  },
};

const journalFiles = (): string[] =>
  Object.keys(vol.toJSON()).filter((file) => file.includes(`migrations/${DEFAULT_SPACE}`));

const readJournalFile = (file: string | undefined): unknown =>
  JSON.parse(String(vol.toJSON()[file ?? ""]));

const journalEntry = (): unknown =>
  readJournalFile(
    journalFiles().find((file) => file.endsWith(".json") && !file.endsWith(".patches.json")),
  );

const apply = (...args: string[]): Promise<unknown> =>
  migrationsCommand.parseAsync(["node", "test", "apply", ...args, "--space", DEFAULT_SPACE]);

describe("migrations apply command", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  beforeEach(() => {
    updates.length = 0;
    schemaModule = {};
    vi.mocked(loadMigrations).mockReset();
    vi.restoreAllMocks();
  });

  const renameCardTitle = defineMigration([
    renameField({ block: "card", field: "title", to: "headline" }),
  ]);
  const renameCardToTeaser = defineMigration([renameBlock({ block: "card", to: "teaser" })]);
  const renameTeaserTitle = defineMigration([
    renameField({ block: "teaser", field: "title", to: "headline" }),
  ]);

  it("should write the migrated content of every story the migration changed", async () => {
    preconditions.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    preconditions.hasStories([storyWithCard()]);
    preconditions.canUpdateStories();

    await apply();

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
    preconditions.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    preconditions.hasStories([storyWithCard()]);
    preconditions.canUpdateStories();

    await apply();

    expect(journalEntry()).toMatchObject({
      space: DEFAULT_SPACE,
      migration: "0001-rename-card-title",
      stories: 1,
      blocks: 1,
    });
    const patches = journalFiles().find((file) => file.endsWith(".patches.json"));
    expect(readJournalFile(patches)).toMatchObject([{ story: "1" }]);
  });

  it("should neither write nor record anything on a dry run", async () => {
    preconditions.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    preconditions.hasStories([storyWithCard()]);
    preconditions.canUpdateStories();

    await apply("--dry-run");

    expect(updates).toEqual([]);
    expect(journalFiles()).toEqual([]);
  });

  it("should report under a dry run the work a real run performs, including for a migration that only matches what an earlier one produced", async () => {
    const info = vi.spyOn(getUI(), "info");
    preconditions.hasMigrations(
      ["0001-rename-card-to-teaser", renameCardToTeaser],
      ["0002-rename-teaser-title", renameTeaserTitle],
    );
    preconditions.hasStories([storyWithCard()]);
    preconditions.canUpdateStories();

    await apply("--dry-run");

    expect(info.mock.calls.map(([message]) => message)).toEqual([
      "0001-rename-card-to-teaser: would change 1 story (1 blocks).",
      "0002-rename-teaser-title: would change 1 story (1 blocks).",
    ]);

    // What the dry run reported is what a real run against the same space does.
    await apply();

    expect(updates.map((update) => update.content)).toEqual([
      expect.objectContaining({ body: [{ _uid: "card-1", component: "teaser", title: "Hi" }] }),
      expect.objectContaining({ body: [{ _uid: "card-1", component: "teaser", headline: "Hi" }] }),
    ]);
  });

  it("should refuse a story that already contains repeated block ids", async () => {
    preconditions.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    preconditions.hasStories([
      {
        ...storyWithCard(),
        content: {
          _uid: "root",
          component: "page",
          body: [
            { _uid: "dup", component: "card", title: "one" },
            { _uid: "dup", component: "card", title: "two" },
          ],
        },
      },
    ]);
    preconditions.canUpdateStories();

    await apply();

    expect(updates).toEqual([]);
    // The run still completed; it just changed nothing.
    expect(journalEntry()).toMatchObject({ stories: 0 });
  });

  it("should record only the stories it managed to write", async () => {
    preconditions.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    preconditions.hasStories([storyWithCard()]);
    preconditions.failsToUpdateStories();

    await apply();

    expect(journalEntry()).toMatchObject({ stories: 0, blocks: 0 });
    const patches = journalFiles().find((file) => file.endsWith(".patches.json"));
    expect(readJournalFile(patches)).toEqual([]);
  });

  it("should refuse a migration naming a block the given schema does not define, before writing anything", async () => {
    preconditions.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    preconditions.hasStories([storyWithCard()]);
    preconditions.canUpdateStories();
    preconditions.hasSchemaDefining({
      page: { name: "page", fields: [{ name: "body", type: "bloks" }] },
    });

    await apply("--schema", "src/schema.ts");

    expect(updates).toEqual([]);
    expect(journalFiles()).toEqual([]);
    expect(process.exitCode).toBe(2);
  });

  it("should apply a migration the given schema does define", async () => {
    preconditions.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    preconditions.hasStories([storyWithCard()]);
    preconditions.canUpdateStories();
    preconditions.hasSchemaDefining({
      card: { name: "card", fields: [{ name: "title", type: "text" }] },
    });

    await apply("--schema", "src/schema.ts");

    expect(updates).toHaveLength(1);
  });

  it("should report that there is nothing to apply when no migration matches the name", async () => {
    preconditions.hasMigrations(["0001-rename-card-title", renameCardTitle]);
    preconditions.hasStories([storyWithCard()]);

    await apply("0002-other");

    expect(updates).toEqual([]);
    expect(process.exitCode).toBe(2);
  });
});
