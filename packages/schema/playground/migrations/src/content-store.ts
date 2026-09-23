/**
 * The two places a migration's content can come from. The engine never sees
 * which: a migration that behaves differently offline is a migration whose test
 * proves nothing.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createManagementApiClient } from "@storyblok/management-api-client";

export type PlaygroundStory = {
  id: number;
  slug: string;
  name: string;
  content: unknown;
};

export interface ContentStore {
  list(): Promise<PlaygroundStory[]>;
  get(id: number): Promise<PlaygroundStory>;
  put(story: PlaygroundStory): Promise<void>;
}

/** Stories as committed JSON, one file per story, named by slug. */
export function fileContentStore(directory: string): ContentStore {
  async function all(): Promise<PlaygroundStory[]> {
    const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
    const stories: PlaygroundStory[] = await Promise.all(
      files.map(async (file) => JSON.parse(await readFile(path.join(directory, file), "utf8"))),
    );
    return stories.sort((a, b) => a.id - b.id);
  }

  return {
    list: all,

    async get(id) {
      const story = (await all()).find((candidate) => candidate.id === id);
      if (!story) {
        throw new Error(`No story ${id} in ${directory}`);
      }
      return story;
    },

    async put(story) {
      // Indented, with a trailing newline: a fixture whose whole content sits on
      // one line makes every migration look like it rewrote the story.
      await writeFile(
        path.join(directory, `${story.slug}.json`),
        `${JSON.stringify(story, null, 2)}\n`,
      );
    },
  };
}

const PER_PAGE = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Stories in a live space, through the Management API. */
export function spaceContentStore(options: { space: string; token: string }): ContentStore {
  const client = createManagementApiClient({
    personalAccessToken: options.token,
    spaceId: Number(options.space),
    throwOnError: true,
  });

  async function get(id: number): Promise<PlaygroundStory> {
    const { data } = await client.stories.get(id);
    const story = data?.story;
    if (!story?.id) {
      throw new Error(`No story ${id} in space ${options.space}`);
    }
    return {
      id: story.id,
      slug: story.slug ?? String(story.id),
      name: story.name ?? "",
      content: story.content,
    };
  }

  /** Ids of every content story in the space; a listing carries no content. */
  async function ids(): Promise<number[]> {
    const found: number[] = [];
    let seen = 0;
    let page = 1;
    while (true) {
      const { data, response } = await client.stories.list({ query: { page, per_page: PER_PAGE } });
      const batch = data?.stories ?? [];
      seen += batch.length;
      for (const story of batch) {
        if (story.id !== undefined && !story.is_folder) {
          found.push(story.id);
        }
      }
      const total = Number(response.headers.get("total"));
      if (batch.length === 0 || Number.isNaN(total) || seen >= total) {
        return found;
      }
      page++;
    }
  }

  return {
    async list() {
      const stories = await Promise.all((await ids()).map(get));
      return stories.sort((a, b) => a.id - b.id);
    },

    get,

    async put(story) {
      if (!isRecord(story.content)) {
        throw new Error(`Story ${story.id} carries no block content to write.`);
      }
      // Only the keys the migration owns are sent. `force_update` skips the
      // optimistic-lock check, which a migration would otherwise trip on every
      // story it read before the previous write landed.
      await client.stories.update(story.id, {
        body: { story: { name: story.name, content: story.content } },
        query: { force_update: true },
      });
    },
  };
}
