import type {
  StoryAlternate,
  Story as StoryGenerated,
  StoryLocalizedPath,
  StoryTranslatedSlug,
} from '../generated/types';
import type { Block } from './define-block';
import type { BlockContent, BlockContentInput } from './define-field';
import type { Prettify } from '../utils/prettify';

const STORY_DEFAULTS = {
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

export type { StoryAlternate, StoryLocalizedPath, StoryTranslatedSlug };

export type StoryComponent = Omit<Block, 'is_root'> & { is_root: true };

type StoryWithSchemaContent<
  TBlock extends StoryComponent = StoryComponent,
  TBlocks = false,
> = Omit<StoryGenerated, 'content'> & { content: BlockContent<TBlock, TBlocks> };

/**
 * A Storyblok CAPI story.
 */
export type Story<
  TBlockOrBlocks extends StoryComponent | Block = StoryComponent,
  TBlocks = false,
> = Prettify<
  [TBlockOrBlocks] extends [StoryComponent]
    // First generic is a `StoryComponent`
    ? StoryWithSchemaContent<TBlockOrBlocks, TBlocks>
    // First generic is most likely a block union ...
    : TBlocks extends false
      // ... and second generic has its default value
      ? StoryWithSchemaContent<Extract<TBlockOrBlocks, StoryComponent>, TBlockOrBlocks>
      // If the first generic is a block union and the second is specified too,
      // it's an invalid state.
      : never
>;

/** Fields that have safe defaults and may be omitted from story input. */
type StoryOptional = keyof typeof STORY_DEFAULTS;

type StoryInput<
  TBlock extends StoryComponent = StoryComponent,
  TBlocks extends Block = never,
> = Prettify<
  Omit<Story<TBlock, TBlocks>, StoryOptional | 'content'>
  & Partial<Pick<Story<TBlock, TBlocks>, StoryOptional>>
  & {
    content: Omit<BlockContentInput<TBlock, TBlocks>, 'component'>;
  }
>;

/**
 * Returns a full {@link Story} with all fields populated. API-assigned
 * fields are optional and default to safe values.
 *
 * @example
 * const myStory = defineStory(pageComponent, {
 *   name: 'Home',
 *   content: { headline: 'Hello World!' },
 * });
 */
// Overload: provides strict generic types so callers get full
// type inference for `TBlock` and `TBlocks`.
export function defineStory<
  TBlock extends StoryComponent,
  TBlocks extends Block,
>(
  component: TBlock,
  story: StoryInput<TBlock, TBlocks>,
): Story<TBlock, TBlocks>;

/**
 * Implementation signature: uses a loose parameter type because TypeScript
 * requires the implementation signature to be assignable to all overloads. Not
 * visible to callers.
 */
export function defineStory(
  component: StoryComponent,
  story: any,
) {
  const { content, ...rest } = story;
  return {
    ...STORY_DEFAULTS,
    ...rest,
    content: {
      ...content,
      component: component.name,
    },
  };
}
