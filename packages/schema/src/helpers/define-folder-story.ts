import type {
  Story as StoryGenerated,
} from '../generated/types';
import type { Prettify } from '../utils/prettify';

const FOLDER_STORY_DEFAULTS = {
  id: 1,
  uuid: '',
  created_at: '',
  updated_at: '',
  published_at: null,
  first_published_at: null,
  full_slug: '',
  group_id: '',
  alternates: [],
  default_full_slug: null,
  release_id: null,
  lang: 'default',
  slug: '',
  parent_id: 0,
  path: null,
  is_startpage: false,
  sort_by_date: null,
  tag_list: [],
  meta_data: null,
  translated_slugs: null,
  position: 0,
  content: {},
};

/** A Storyblok folder story (no content component). */
export type FolderStory = Prettify<
  Omit<StoryGenerated, 'content' | 'is_folder'>
  & { is_folder: true; content: Record<string, never> }
>;

/** Fields that have safe defaults and may be omitted from folder story input. */
type FolderStoryOptional = keyof typeof FOLDER_STORY_DEFAULTS;

type FolderStoryInput = Prettify<
  Omit<FolderStory, FolderStoryOptional | 'is_folder'>
  & Partial<Pick<FolderStory, FolderStoryOptional>>
>;

/**
 * Returns a full {@link FolderStory} with all fields populated.
 *
 * @example
 * const folder = defineFolderStory({
 *   name: 'Blog',
 *   slug: 'blog',
 * });
 */
export function defineFolderStory(story: FolderStoryInput): FolderStory;

export function defineFolderStory(story: any) {
  return {
    ...FOLDER_STORY_DEFAULTS,
    ...story,
    is_folder: true,
  };
}
