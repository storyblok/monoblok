import { http, HttpResponse } from "msw";
import type { SetupServerApi } from "msw/node";
import { vol } from "memfs";
import { vi } from "vitest";
import type { CompiledMigration } from "@storyblok/schema/migrations";
import { DEFAULT_SPACE } from "../../__tests__/helpers";
import { isRecord } from "../../../utils";
import { importUserModuleDefault } from "../../../utils/user-module";

const MAPI = `https://mapi.storyblok.com/v1/spaces/${DEFAULT_SPACE}`;
export const MIGRATIONS_DIRECTORY = `.storyblok/migrations/${DEFAULT_SPACE}`;
const JOURNAL_DIRECTORY = `.storyblok/migrations/.journal/${DEFAULT_SPACE}`;

export type RemoteStory = {
  id: number;
  name: string;
  slug: string;
  full_slug: string;
  published?: boolean;
  unpublished_changes?: boolean;
  deleted_at?: string | null;
  content: Record<string, unknown>;
};

export type StoryWrite = { id: number; content: Record<string, unknown>; publish: boolean };

function componentsIn(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => componentsIn(item, into));
  } else if (isRecord(value)) {
    if (typeof value.component === "string") into.add(value.component);
    Object.values(value).forEach((item) => componentsIn(item, into));
  }
  return into;
}

export const storyWithCard = (overrides: Partial<RemoteStory> = {}): RemoteStory => ({
  id: 1,
  name: "Home",
  slug: "home",
  full_slug: "home",
  published: false,
  unpublished_changes: false,
  content: {
    _uid: "root",
    component: "page",
    body: [{ _uid: "card-1", component: "card", title: "Hi" }],
  },
  ...overrides,
});

/** A space as the API holds it: a write changes what a later read returns. */
export function createRemoteSpace(server: SetupServerApi) {
  const stories = new Map<number, RemoteStory>();
  const writes: StoryWrite[] = [];
  const migrations = new Map<string, CompiledMigration>();

  vi.mocked(importUserModuleDefault).mockImplementation(async (file) => {
    const id =
      file
        .split("/")
        .pop()
        ?.replace(/\.\w+$/, "") ?? "";
    return migrations.get(id);
  });

  return {
    writes,
    story: (id: number) => stories.get(id),
    hasMigrations(...entries: [id: string, migration: CompiledMigration][]) {
      for (const [id, migration] of entries) {
        migrations.set(id, migration);
        vol.fromJSON({ [`${MIGRATIONS_DIRECTORY}/${id}.ts`]: "export default {};" });
      }
    },
    hasStories(...entries: RemoteStory[]) {
      for (const story of entries) stories.set(story.id, story);
      server.use(
        http.get(`${MAPI}/stories`, ({ request }) => {
          const component = new URL(request.url).searchParams.get("contain_component");
          const matching = [...stories.values()].filter(
            (story) => !component || componentsIn(story.content).has(component),
          );
          return HttpResponse.json(
            { stories: matching.map(({ content: _content, ...rest }) => rest) },
            { headers: { Total: String(matching.length), "Per-Page": "100" } },
          );
        }),
        http.get(`${MAPI}/stories/:id`, ({ params }) => {
          const story = stories.get(Number(params.id));
          return story
            ? HttpResponse.json({ story })
            : HttpResponse.json({ error: "Not Found" }, { status: 404 });
        }),
      );
    },
    hasReleases(...releases: { id: number; name: string; released: boolean }[]) {
      server.use(
        http.get(`${MAPI}/releases`, () =>
          HttpResponse.json({
            releases: releases.map((release) => ({
              uuid: `release-${release.id}`,
              branches_to_deploy: [],
              created_at: "2026-01-01T00:00:00.000Z",
              ...release,
            })),
          }),
        ),
      );
    },
    /** `onWrite` runs before each write lands, to observe what a run did up to that point. */
    canUpdateStories(onWrite?: (id: number) => void) {
      server.use(
        http.put(`${MAPI}/stories/:id`, async ({ request, params }) => {
          const body = await request.json();
          if (!isRecord(body) || !isRecord(body.story) || !isRecord(body.story.content)) {
            return HttpResponse.json({ error: "Bad Request" }, { status: 400 });
          }
          const content = body.story.content;
          const id = Number(params.id);
          if (stories.get(id)?.deleted_at) {
            return HttpResponse.json({ error: "Not Found" }, { status: 404 });
          }
          const publish = new URL(request.url).searchParams.get("publish") === "true";
          onWrite?.(id);
          writes.push({ id, content, publish });
          const story = stories.get(id);
          if (story) {
            stories.set(id, {
              ...story,
              content,
              published: story.published === true || publish,
              unpublished_changes: !publish && story.published === true,
            });
          }
          return HttpResponse.json({ story: { id, ...body.story } });
        }),
      );
    },
    failsToUpdateStories() {
      server.use(
        http.put(`${MAPI}/stories/:id`, () =>
          HttpResponse.json({ error: "Unprocessable Entity" }, { status: 422 }),
        ),
      );
    },
    editsStory(id: number, edit: (content: Record<string, unknown>) => void) {
      const story = stories.get(id);
      if (!story) throw new Error(`No story ${id}`);
      const content = structuredClone(story.content);
      edit(content);
      stories.set(id, { ...story, content, unpublished_changes: story.published === true });
    },
    deletesStory(id: number) {
      stories.delete(id);
    },
    /** A trashed story: the API still returns it, with `deleted_at` set, but refuses writes to it. */
    trashesStory(id: number) {
      const story = stories.get(id);
      if (!story) throw new Error(`No story ${id}`);
      stories.set(id, { ...story, deleted_at: "2026-01-02T00:00:00.000Z" });
    },
    failsToReadStory(id: number) {
      server.use(
        http.get(`${MAPI}/stories/${id}`, () =>
          HttpResponse.json({ error: "Internal Server Error" }, { status: 500 }),
        ),
      );
    },
    failsToListReleases() {
      server.use(
        http.get(`${MAPI}/releases`, () =>
          HttpResponse.json({ error: "Forbidden" }, { status: 403 }),
        ),
      );
    },
  };
}

export const journalEntries = (): Record<string, unknown>[] =>
  Object.entries(vol.toJSON())
    .filter(
      ([file, body]) =>
        file.includes(JOURNAL_DIRECTORY) &&
        file.endsWith(".json") &&
        !file.endsWith(".patches.json") &&
        body !== null,
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, body]) => JSON.parse(String(body)));
