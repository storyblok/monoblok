import { getMapiClient } from "../../../api";
import { fetchAllPages, isRecord } from "../../../utils";
import { fetchStory, updateStory } from "../../stories/actions";
import type { Story } from "../../stories/constants";
import type { BlockRename } from "./block-renames";

/**
 * The number of stories that contain `block`, or `undefined` when the space
 * can't be read.
 */
export async function countStoriesUsing(space: string, block: string): Promise<number | undefined> {
  try {
    const { response } = await getMapiClient().stories.list({
      path: { space_id: Number(space) },
      query: { contain_component: block, per_page: 1, story_only: true },
      throwOnError: true,
    });
    const total = Number(response.headers.get("total"));
    return Number.isFinite(total) ? total : undefined;
  } catch {
    return undefined;
  }
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

/** Points each folder's default and allowed content types at the blocks' new names. */
export async function renameFolderRestrictions(
  space: string,
  folders: readonly FolderRestriction[],
  renames: readonly BlockRename[],
): Promise<void> {
  const renamed = new Map(renames.map(({ from, to }) => [from, to]));
  const rename = (name: string) => renamed.get(name) ?? name;
  for (const { story, defaultRoot, contentTypes } of folders) {
    const content = isRecord(story.content) ? story.content : {};
    await updateStory(space, story.id, {
      story: {
        name: story.name,
        slug: story.slug,
        parent_id: story.parent_id,
        is_folder: true,
        ...(defaultRoot !== undefined && { default_root: rename(defaultRoot) }),
        content: { ...content, content_types: contentTypes.map(rename) },
      },
    });
  }
}
