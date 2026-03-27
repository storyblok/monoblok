import type { StoryCreate as StoryCreateGenerated, Story as StoryMapi, StoryUpdate as StoryUpdateGenerated } from '../../generated/mapi-types';
import type { Component } from '../../types/component';
import type { StoryContent } from '../../types/story';
import type { Prettify } from '../../types/utils';

/**
 * A Storyblok MAPI story typed to a specific component.
 * Includes additional MAPI-only metadata fields (published, unpublished_changes, etc.)
 * beyond the base story fields.
 *
 * @param TComponent - The component definition for this story's content.
 * @param TSchema - Optional union of all component definitions in scope, forwarded
 *   to `StoryContent` to enable full typing of nested blok fields.
 */
export type Story<
  TComponent extends Component = Component,
  TSchema extends Component = never,
> = Prettify<
  Omit<StoryMapi, 'content'> & {
    content: StoryContent<TComponent, TSchema>;
  }
>;

/** Payload for creating a story via the MAPI. */
export type StoryCreate<
  TComponent extends Component = Component,
  TSchema extends Component = never,
> = Prettify<
  Omit<StoryCreateGenerated, 'content'> & {
    content?: StoryContent<TComponent, TSchema> | undefined;
  }
>;

/** Payload for updating a story via the MAPI. */
export type StoryUpdate<
  TComponent extends Component = Component,
  TSchema extends Component = never,
> = Prettify<
  Omit<StoryUpdateGenerated, 'content'> & {
    content?: StoryContent<TComponent, TSchema> | undefined;
  }
>;
