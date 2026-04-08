import type { StoryCreate as StoryCreateGenerated, Story as StoryGenerated, StoryUpdate as StoryUpdateGenerated } from '../../generated/mapi-types';
import type { Block } from '../../helpers/define-block';
import type { BlockContent, BlockContentInput } from '../../helpers/define-field';
import type { Prettify } from '../../utils/prettify';

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

export type StoryComponent = Omit<Block, 'is_root'> & { is_root: true };

type StoryWithSchemaContent<
  TStory extends StoryGenerated | StoryCreateGenerated | StoryUpdateGenerated,
  TBlock extends StoryComponent = StoryComponent,
  TBlocks = false,
  // When `TBlock` is the base `StoryComponent` default (i.e. no specific
  // block was provided), keep the generated content type so that
  // `Story` / `StoryCreate` / `StoryUpdate` without generics are structurally
  // identical to the raw API response — making them directly assignable to
  // values returned by the management-api-client without extra casting.
  // A specific block always has a literal `name` (e.g. `'page'`), so
  // `StoryComponent` (with `name: string`) cannot extend it, and the
  // schema-narrowed content type is used instead.
  //
  // For create/update types, use `BlockContentInput` where `_uid` is optional
  // since Storyblok generates it automatically.
> = StoryComponent extends TBlock
  ? TStory
  : Omit<TStory, 'content'> & {
    content: TStory extends StoryCreateGenerated | StoryUpdateGenerated
      ? BlockContentInput<TBlock, TBlocks>
      : BlockContent<TBlock, TBlocks>;
  };

type MakeStory<
  TStory extends StoryGenerated | StoryCreateGenerated | StoryUpdateGenerated,
  TBlockOrBlocks extends StoryComponent | Block = StoryComponent,
  TBlocks = false,
> = Prettify<
  [TBlockOrBlocks] extends [StoryComponent]
    // First generic is a `StoryComponent`
    ? StoryWithSchemaContent<TStory, TBlockOrBlocks, TBlocks>
    // First generic is most likely a block union ...
    : TBlocks extends false
      // ... and second generic has its default value
      ? StoryWithSchemaContent<TStory, Extract<TBlockOrBlocks, StoryComponent>, TBlockOrBlocks>
      // If the first generic is a block union and the second is specified too,
      // it's an invalid state.
      : never
>;

/**
 * A Storyblok MAPI story.
 */
export type Story<
  TBlockOrBlocks extends StoryComponent | Block = StoryComponent,
  TBlocks = false,
> = MakeStory<StoryGenerated, TBlockOrBlocks, TBlocks>;

/** Payload for creating a story via the MAPI. */
export type StoryCreate<
  TBlockOrBlocks extends StoryComponent | Block = StoryComponent,
  TBlocks = false,
> = MakeStory<StoryCreateGenerated, TBlockOrBlocks, TBlocks>;

/** Payload for updating a story via the MAPI. */
export type StoryUpdate<
  TBlockOrBlocks extends StoryComponent | Block = StoryComponent,
  TBlocks = false,
> = MakeStory<StoryUpdateGenerated, TBlockOrBlocks, TBlocks>;

/** Fields that have safe defaults and may be omitted from story input. */
type StoryOptional = keyof typeof STORY_DEFAULTS;

type MakeStoryInput<
  TStory extends Story | StoryCreate | StoryUpdate,
  TBlock extends StoryComponent = StoryComponent,
  TBlocks extends Block = never,
> = Prettify<
  Omit<TStory, StoryOptional | 'content'>
  & Partial<Pick<TStory, Extract<StoryOptional, keyof TStory>>>
  & {
    content: Omit<BlockContentInput<TBlock, TBlocks>, 'component'>;
  }
>;

type StoryInput<
  TBlock extends StoryComponent = StoryComponent,
  TBlocks extends Block = never,
> = MakeStoryInput<
  Story,
  TBlock,
  TBlocks
>;

type StoryCreateInput<
  TBlock extends StoryComponent = StoryComponent,
  TBlocks extends Block = never,
> = MakeStoryInput<
  StoryCreate,
  TBlock,
  TBlocks
>;

type StoryUpdateInput<
  TBlock extends StoryComponent = StoryComponent,
  TBlocks extends Block = never,
> = Prettify<
  Omit<MakeStoryInput<StoryUpdate, TBlock, TBlocks>, 'content'>
  & {
    content: Partial<Omit<BlockContentInput<TBlock, TBlocks>, 'component'>>;
  }
>;

/**
 * Returns a full {@link Story} with all fields populated. API-assigned
 * fields are optional and default to safe values.
 *
 * @example
 * const myStory = defineStory(pageComponent, {
 *   name: 'My Page',
 *   content: { headline: 'Hello World!' },
 * });
 */
// Overload: provides strict generic types so callers get full
// type inference for the component.
export function defineStory<
  const TBlock extends StoryComponent,
  const TBlocks extends Block = never,
>(
  component: TBlock,
  story: StoryInput<TBlock, TBlocks>,
): Story<TBlock, TBlocks>;

export function defineStory(component: StoryComponent, story: any) {
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

/**
 * Defines a story creation payload.
 *
 * @example
 * const payload = defineStoryCreate(pageComponent, {
 *   name: 'My Page',
 *   content: { headline: 'Hello World!' },
 * });
 */
// Overload: provides strict generic types so callers get full
// type inference for the component.
export function defineStoryCreate<
  const TBlock extends StoryComponent,
  const TBlocks extends Block = never,
>(
  component: TBlock,
  story: StoryCreateInput<TBlock, TBlocks>,
): StoryCreate<TBlock, TBlocks>;

export function defineStoryCreate(component: StoryComponent, story: any) {
  const { content, ...rest } = story;
  return {
    ...rest,
    content: {
      ...content,
      component: component.name,
    },
  };
}

/**
 * Defines a story update payload.
 *
 * @example
 * const payload = defineStoryUpdate(pageComponent, {
 *   content: { headline: 'Updated!' },
 * });
 */
// Overload: provides strict generic types so callers get full
// type inference for the component.
export function defineStoryUpdate<
  const TBlock extends StoryComponent,
  const TBlocks extends Block = never,
>(
  component: TBlock,
  story: StoryUpdateInput<TBlock, TBlocks>,
): StoryUpdate<TBlock, TBlocks>;

export function defineStoryUpdate(component: StoryComponent, story: any) {
  const { content, ...rest } = story;
  return {
    ...rest,
    ...(content && {
      content: {
        ...content,
        component: component.name,
      },
    }),
  };
}
