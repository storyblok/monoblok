import type { StoryAlternate } from '../generated/capi/types.gen';
import type { StoryLocalizedPath, StoryTranslatedSlug } from '../generated/mapi/types.gen';
import type { MapiStory, StoryCreate, StoryUpdate } from '../generated/types/mapi-story';
import type { Story, StoryBlock } from '../generated/types/story';
import type { Block } from './define-block';
import type { BlockContentInput } from './define-field';
import type { Prettify } from '../utils/prettify';

const CAPI_STORY_DEFAULTS = {
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
};

const MAPI_STORY_DEFAULTS = {
  id: 1,
  uuid: '',
  created_at: '',
  updated_at: '',
  published_at: null,
  first_published_at: null,
  full_slug: '',
  group_id: '',
  alternates: [],
  slug: '',
  parent_id: null,
  parent: null,
  path: null,
  is_folder: false,
  is_startpage: false,
  sort_by_date: null,
  tag_list: [],
  meta_data: null,
  translated_slugs: [],
  translated_stories: [],
  localized_paths: [],
  position: 0,
  deleted_at: null,
  published: null,
  default_root: null,
  disble_fe_editor: false,
  disable_fe_editor: false,
  unpublished_changes: null,
  imported_at: null,
  preview_token: { token: '', timestamp: '' },
  pinned: false,
  breadcrumbs: [],
  publish_at: null,
  expire_at: null,
  last_author: null,
  last_author_id: null,
  user_ids: [],
  space_role_ids: [],
  can_not_view: null,
  is_scheduled: null,
  scheduled_dates: null,
  ideas: [],
  favourite_for_user_ids: [],
};

export type { MapiStory, Story, StoryBlock, StoryCreate, StoryUpdate };
export type { StoryAlternate, StoryLocalizedPath, StoryTranslatedSlug };

type CapiStoryOptional = keyof typeof CAPI_STORY_DEFAULTS;

type CapiStoryInput<
  TBlock extends StoryBlock = StoryBlock,
  TBlocks extends Block = never,
> = Prettify<
  Omit<Story<TBlock, TBlocks>, CapiStoryOptional | 'content'>
  & Partial<Pick<Story<TBlock, TBlocks>, CapiStoryOptional>>
  & {
    content: Omit<BlockContentInput<TBlock, TBlocks>, 'component'>;
  }
>;

/**
 * Returns a full CDN {@link Story} with all fields populated.
 *
 * @example
 * const myStory = defineStory(pageComponent, {
 *   name: 'Home',
 *   content: { headline: 'Hello World!' },
 * });
 */
export function defineStory<
  TBlock extends StoryBlock,
  TBlocks extends Block,
>(component: TBlock, story: CapiStoryInput<TBlock, TBlocks>): Story<TBlock, TBlocks>;

export function defineStory(component: StoryBlock, story: any) {
  const { content, ...rest } = story;
  return {
    ...CAPI_STORY_DEFAULTS,
    ...rest,
    content: { ...content, component: component.name },
  };
}

// ---------------------------------------------------------------------------
// MAPI Story helpers
// ---------------------------------------------------------------------------

type MapiStoryOptional = keyof typeof MAPI_STORY_DEFAULTS;

type MakeMapiStoryInput<
  TStory extends MapiStory | StoryCreate | StoryUpdate,
  TBlock extends StoryBlock = StoryBlock,
  TBlocks extends Block = never,
> = Prettify<
  Omit<TStory, MapiStoryOptional | 'content'>
  & Partial<Pick<TStory, Extract<MapiStoryOptional, keyof TStory>>>
  & {
    content: Omit<BlockContentInput<TBlock, TBlocks>, 'component'>;
  }
>;

type MapiStoryInput<
  TBlock extends StoryBlock = StoryBlock,
  TBlocks extends Block = never,
> = MakeMapiStoryInput<MapiStory, TBlock, TBlocks>;

type StoryCreateInput<
  TBlock extends StoryBlock = StoryBlock,
  TBlocks extends Block = never,
> = MakeMapiStoryInput<StoryCreate, TBlock, TBlocks>;

type StoryUpdateInput<
  TBlock extends StoryBlock = StoryBlock,
  TBlocks extends Block = never,
> = Prettify<
  Omit<MakeMapiStoryInput<StoryUpdate, TBlock, TBlocks>, 'content'>
  & {
    content: Partial<Omit<BlockContentInput<TBlock, TBlocks>, 'component'>>;
  }
>;

/**
 * Returns a full MAPI {@link MapiStory} with all fields populated.
 *
 * @example
 * const myStory = defineMapiStory(pageComponent, {
 *   name: 'My Page',
 *   content: { headline: 'Hello World!' },
 * });
 */
export function defineMapiStory<
  const TBlock extends StoryBlock,
  const TBlocks extends Block = never,
>(component: TBlock, story: MapiStoryInput<TBlock, TBlocks>): MapiStory<TBlock, TBlocks>;

export function defineMapiStory(component: StoryBlock, story: any) {
  const { content, ...rest } = story;
  return {
    ...MAPI_STORY_DEFAULTS,
    ...rest,
    content: { ...content, component: component.name },
  };
}

/**
 * Defines a story creation payload for the MAPI.
 *
 * @example
 * const payload = defineStoryCreate(pageComponent, {
 *   name: 'My Page',
 *   content: { headline: 'Hello World!' },
 * });
 */
export function defineStoryCreate<
  const TBlock extends StoryBlock,
  const TBlocks extends Block = never,
>(component: TBlock, story: StoryCreateInput<TBlock, TBlocks>): StoryCreate<TBlock, TBlocks>;

export function defineStoryCreate(component: StoryBlock, story: any) {
  const { content, ...rest } = story;
  return {
    ...rest,
    content: { ...content, component: component.name },
  };
}

/**
 * Defines a story update payload for the MAPI.
 *
 * @example
 * const payload = defineStoryUpdate(pageComponent, {
 *   content: { headline: 'Updated!' },
 * });
 */
export function defineStoryUpdate<
  const TBlock extends StoryBlock,
  const TBlocks extends Block = never,
>(component: TBlock, story: StoryUpdateInput<TBlock, TBlocks>): StoryUpdate<TBlock, TBlocks>;

export function defineStoryUpdate(component: StoryBlock, story: any) {
  const { content, ...rest } = story;
  return {
    ...rest,
    ...(content && {
      content: { ...content, component: component.name },
    }),
  };
}
