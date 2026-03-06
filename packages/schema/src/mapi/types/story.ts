import type { story_create, story_mapi, story_update } from '../../generated/types';
import type { Component } from '../../types/component';
import type { StoryContent } from '../../types/story';
import type { Prettify } from '../../types/utils';

/**
 * A Storyblok MAPI story typed to a specific component.
 * Includes additional MAPI-only metadata fields (published, unpublished_changes, etc.)
 * beyond the base story fields.
 */
export type Story<TComponent extends Component = Component> = Prettify<
  Omit<story_mapi, 'content'> & {
    content: StoryContent<TComponent>;
  }
>;

/**
 * Payload for creating a story via the MAPI.
 * `name` is required; `content` is typed to the component's schema when provided.
 */
export type StoryCreate<TComponent extends Component = Component> = Prettify<
  Omit<story_create, 'content'> & {
    content?: StoryContent<TComponent> | undefined;
  }
>;

/**
 * Payload for updating a story via the MAPI.
 * All fields are optional; `content` is typed to the component's schema when provided.
 */
export type StoryUpdate<TComponent extends Component = Component> = Prettify<
  Omit<story_update, 'content'> & {
    content?: StoryContent<TComponent> | undefined;
  }
>;
