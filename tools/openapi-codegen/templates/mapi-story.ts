import type {
  MapiStory as MapiStoryGenerated,
  StoryCreate as StoryCreateGenerated,
  StoryUpdate as StoryUpdateGenerated,
} from './_sources';
import type { Block, RootBlock } from './block';
import type { BlockContent, BlockContentInput } from './field';

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type MapiStoryWithSchemaContent<
  TStory extends MapiStoryGenerated | StoryCreateGenerated | StoryUpdateGenerated,
  TBlock extends RootBlock = RootBlock,
  TBlocks = false,
> = RootBlock extends TBlock
  ? TStory
  : Omit<TStory, 'content'> & {
    content: TStory extends StoryCreateGenerated | StoryUpdateGenerated
      ? BlockContentInput<TBlock, TBlocks>
      : BlockContent<TBlock, TBlocks>;
  };

type MakeMapiStory<
  TStory extends MapiStoryGenerated | StoryCreateGenerated | StoryUpdateGenerated,
  TBlockOrBlocks extends RootBlock | Block = RootBlock,
  TBlocks = false,
> = Prettify<
  [TBlockOrBlocks] extends [RootBlock]
    ? MapiStoryWithSchemaContent<TStory, TBlockOrBlocks, TBlocks>
    : TBlocks extends false
      ? MapiStoryWithSchemaContent<TStory, Extract<TBlockOrBlocks, RootBlock>, TBlockOrBlocks>
      : never
>;

/** A Storyblok MAPI story. */
export type MapiStory<
  TBlockOrBlocks extends RootBlock | Block = RootBlock,
  TBlocks = false,
> = MakeMapiStory<MapiStoryGenerated, TBlockOrBlocks, TBlocks>;

/** Payload for creating a story via the MAPI. */
export type StoryCreate<
  TBlockOrBlocks extends RootBlock | Block = RootBlock,
  TBlocks = false,
> = MakeMapiStory<StoryCreateGenerated, TBlockOrBlocks, TBlocks>;

/** Payload for updating a story via the MAPI. */
export type StoryUpdate<
  TBlockOrBlocks extends RootBlock | Block = RootBlock,
  TBlocks = false,
> = MakeMapiStory<StoryUpdateGenerated, TBlockOrBlocks, TBlocks>;
