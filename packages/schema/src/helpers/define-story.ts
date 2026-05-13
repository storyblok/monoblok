import type {
  Story as CapiStoryGenerated,
  StoryAlternate,
  StoryLocalizedPath,
  StoryTranslatedSlug,
} from '../generated/types';
import type {
  Story as MapiStoryGenerated,
  StoryCreate as StoryCreateGenerated,
  StoryUpdate as StoryUpdateGenerated,
} from '../generated/mapi-types';
import type { Block } from './define-block';
import type { BlockContent, BlockContentInput } from './define-field';
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
  parent_id: 0,
  path: null,
  is_startpage: false,
  sort_by_date: null,
  tag_list: [],
  meta_data: null,
  translated_slugs: null,
  position: 0,
};

export type { StoryAlternate, StoryLocalizedPath, StoryTranslatedSlug };

export type StoryComponent = Omit<Block, 'is_root'> & { is_root: true };

// ---------------------------------------------------------------------------
// CDN (CAPI) Story
// ---------------------------------------------------------------------------

type CapiStoryWithSchemaContent<
  TBlock extends StoryComponent = StoryComponent,
  TBlocks = false,
> = Omit<CapiStoryGenerated, 'content'> & { content: BlockContent<TBlock, TBlocks> };

/**
 * A Storyblok CDN (CAPI) story.
 */
export type Story<
  TBlockOrBlocks extends StoryComponent | Block = StoryComponent,
  TBlocks = false,
> = Prettify<
  [TBlockOrBlocks] extends [StoryComponent]
    ? CapiStoryWithSchemaContent<TBlockOrBlocks, TBlocks>
    : TBlocks extends false
      ? CapiStoryWithSchemaContent<Extract<TBlockOrBlocks, StoryComponent>, TBlockOrBlocks>
      : never
>;

type CapiStoryOptional = keyof typeof CAPI_STORY_DEFAULTS;

type CapiStoryInput<
  TBlock extends StoryComponent = StoryComponent,
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
  TBlock extends StoryComponent,
  TBlocks extends Block,
>(component: TBlock, story: CapiStoryInput<TBlock, TBlocks>): Story<TBlock, TBlocks>;

export function defineStory(component: StoryComponent, story: any) {
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

type MapiStoryWithSchemaContent<
  TStory extends MapiStoryGenerated | StoryCreateGenerated | StoryUpdateGenerated,
  TBlock extends StoryComponent = StoryComponent,
  TBlocks = false,
> = StoryComponent extends TBlock
  ? TStory
  : Omit<TStory, 'content'> & {
    content: TStory extends StoryCreateGenerated | StoryUpdateGenerated
      ? BlockContentInput<TBlock, TBlocks>
      : BlockContent<TBlock, TBlocks>;
  };

type MakeMapiStory<
  TStory extends MapiStoryGenerated | StoryCreateGenerated | StoryUpdateGenerated,
  TBlockOrBlocks extends StoryComponent | Block = StoryComponent,
  TBlocks = false,
> = Prettify<
  [TBlockOrBlocks] extends [StoryComponent]
    ? MapiStoryWithSchemaContent<TStory, TBlockOrBlocks, TBlocks>
    : TBlocks extends false
      ? MapiStoryWithSchemaContent<TStory, Extract<TBlockOrBlocks, StoryComponent>, TBlockOrBlocks>
      : never
>;

/**
 * A Storyblok MAPI story.
 */
export type MapiStory<
  TBlockOrBlocks extends StoryComponent | Block = StoryComponent,
  TBlocks = false,
> = MakeMapiStory<MapiStoryGenerated, TBlockOrBlocks, TBlocks>;

/** Payload for creating a story via the MAPI. */
export type StoryCreate<
  TBlockOrBlocks extends StoryComponent | Block = StoryComponent,
  TBlocks = false,
> = MakeMapiStory<StoryCreateGenerated, TBlockOrBlocks, TBlocks>;

/** Payload for updating a story via the MAPI. */
export type StoryUpdate<
  TBlockOrBlocks extends StoryComponent | Block = StoryComponent,
  TBlocks = false,
> = MakeMapiStory<StoryUpdateGenerated, TBlockOrBlocks, TBlocks>;

type MapiStoryOptional = keyof typeof MAPI_STORY_DEFAULTS;

type MakeMapiStoryInput<
  TStory extends MapiStory | StoryCreate | StoryUpdate,
  TBlock extends StoryComponent = StoryComponent,
  TBlocks extends Block = never,
> = Prettify<
  Omit<TStory, MapiStoryOptional | 'content'>
  & Partial<Pick<TStory, Extract<MapiStoryOptional, keyof TStory>>>
  & {
    content: Omit<BlockContentInput<TBlock, TBlocks>, 'component'>;
  }
>;

type MapiStoryInput<
  TBlock extends StoryComponent = StoryComponent,
  TBlocks extends Block = never,
> = MakeMapiStoryInput<MapiStory, TBlock, TBlocks>;

type StoryCreateInput<
  TBlock extends StoryComponent = StoryComponent,
  TBlocks extends Block = never,
> = MakeMapiStoryInput<StoryCreate, TBlock, TBlocks>;

type StoryUpdateInput<
  TBlock extends StoryComponent = StoryComponent,
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
  const TBlock extends StoryComponent,
  const TBlocks extends Block = never,
>(component: TBlock, story: MapiStoryInput<TBlock, TBlocks>): MapiStory<TBlock, TBlocks>;

export function defineMapiStory(component: StoryComponent, story: any) {
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
  const TBlock extends StoryComponent,
  const TBlocks extends Block = never,
>(component: TBlock, story: StoryCreateInput<TBlock, TBlocks>): StoryCreate<TBlock, TBlocks>;

export function defineStoryCreate(component: StoryComponent, story: any) {
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
  const TBlock extends StoryComponent,
  const TBlocks extends Block = never,
>(component: TBlock, story: StoryUpdateInput<TBlock, TBlocks>): StoryUpdate<TBlock, TBlocks>;

export function defineStoryUpdate(component: StoryComponent, story: any) {
  const { content, ...rest } = story;
  return {
    ...rest,
    ...(content && {
      content: { ...content, component: component.name },
    }),
  };
}
