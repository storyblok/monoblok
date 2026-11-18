import { getMapiClient } from "../../../api";
import { fetchAllPages, isRecord } from "../../../utils";
import { fetchStory } from "../../stories/actions";
import type { Story } from "../../stories/constants";

/** The number of stories that contain `block`. */
export async function countStoriesUsing(space: string, block: string): Promise<number> {
  const { response } = await getMapiClient().stories.list({
    path: { space_id: Number(space) },
    query: { contain_component: block, per_page: 1, story_only: true },
    throwOnError: true,
  });
  const total = Number(response.headers.get("total") ?? Number.NaN);
  if (!Number.isFinite(total)) {
    throw new TypeError(`The Management API returned no story count for ${block}.`);
  }
  return total;
}

/** A folder's default content type and the content types it allows, by block name. */
export type FolderRestriction = {
  story: Story;
  defaultRoot: string | undefined;
  contentTypes: string[];
};

function contentTypesOf(story: Story): string[] {
  const content: unknown = story.content;
  if (!isRecord(content) || !Array.isArray(content.content_types)) return [];
  return content.content_types.filter((name): name is string => typeof name === "string");
}

/** The folders whose default content type or allowed content types name one of `blocks`. */
export async function foldersNaming(
  space: string,
  blocks: ReadonlySet<string>,
): Promise<FolderRestriction[]> {
  const client = getMapiClient();
  const folders = await fetchAllPages(
    (page) =>
      client.stories.list({
        path: { space_id: Number(space) },
        query: { folder_only: true, per_page: 100, page },
        throwOnError: true,
      }),
    (data) => data.stories ?? [],
  );
  const restrictions: FolderRestriction[] = [];
  for (const { id } of folders) {
    const story = await fetchStory(space, id);
    if (!story) continue;
    const restriction = {
      story,
      defaultRoot: story.default_root ?? undefined,
      contentTypes: contentTypesOf(story),
    };
    const named = [restriction.defaultRoot, ...restriction.contentTypes];
    if (named.some((name) => name !== undefined && blocks.has(name))) {
      restrictions.push(restriction);
    }
  }
  return restrictions;
}

/** A folder's slug and the block names it restricts to, for messages. */
export function describeFolder(folder: FolderRestriction): string {
  return folder.story.full_slug ?? folder.story.slug ?? String(folder.story.id);
}
