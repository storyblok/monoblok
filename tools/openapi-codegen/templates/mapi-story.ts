import type {
  MapiStory as MapiStoryGenerated,
  StoryCreate as StoryCreateGenerated,
  StoryUpdate as StoryUpdateGenerated,
} from './_sources';
import type { Block, RootBlock } from './block';
import type { BlockContent, BlockContentInput } from './field';

type Prettify<T> = { [K in keyof T]: T[K] } & {};

/** Replaces the keys of `T` that also appear in `U` with the definitions from `U`. */
type Override<T, U> = Prettify<Omit<T, keyof U> & U>;

/**
 * Registry of all blocks, threaded through to resolve nested `bloks` fields.
 * `NoBlocks` (the default) leaves nested content loose (`BlockContentBase`).
 */
type NoBlocks = false;

/**
 * Overrides a generated story's `content` with schema-typed block content.
 * Base (un-narrowed) `RootBlock` means no schema was supplied, so the generated
 * story passes through unchanged.
 */
type MapiStoryWithSchemaContent<
  TStory extends MapiStoryGenerated | StoryCreateGenerated | StoryUpdateGenerated,
  TBlock extends RootBlock = RootBlock,
  TBlocks = NoBlocks,
> = RootBlock extends TBlock
  ? TStory
  : Override<TStory, {
    content: TStory extends StoryCreateGenerated | StoryUpdateGenerated
      ? BlockContentInput<TBlock, TBlocks>
      : BlockContent<TBlock, TBlocks>;
  }>;

type MakeMapiStory<
  TStory extends MapiStoryGenerated | StoryCreateGenerated | StoryUpdateGenerated,
  TBlockOrBlocks extends RootBlock | Block = RootBlock,
  TBlocks = NoBlocks,
> = Prettify<
  // caller passed root block(s) directly → use them as the content type
  [TBlockOrBlocks] extends [RootBlock]
    ? MapiStoryWithSchemaContent<TStory, TBlockOrBlocks, TBlocks>
    // caller passed the full block union → derive root blocks, thread the union as the registry
    : TBlocks extends NoBlocks
      ? MapiStoryWithSchemaContent<TStory, Extract<TBlockOrBlocks, RootBlock>, TBlockOrBlocks>
      : never
>;

/** A Storyblok MAPI story. */
export type MapiStory<
  TBlockOrBlocks extends RootBlock | Block = RootBlock,
  TBlocks = NoBlocks,
> = MakeMapiStory<MapiStoryGenerated, TBlockOrBlocks, TBlocks>;

/** Payload for creating a story via the MAPI. */
export type StoryCreate<
  TBlockOrBlocks extends RootBlock | Block = RootBlock,
  TBlocks = NoBlocks,
> = MakeMapiStory<StoryCreateGenerated, TBlockOrBlocks, TBlocks>;

/** Payload for updating a story via the MAPI. */
export type StoryUpdate<
  TBlockOrBlocks extends RootBlock | Block = RootBlock,
  TBlocks = NoBlocks,
> = MakeMapiStory<StoryUpdateGenerated, TBlockOrBlocks, TBlocks>;
