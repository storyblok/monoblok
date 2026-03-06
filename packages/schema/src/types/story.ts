import type { story_capi } from '../generated/types';
import type { Component } from './component';
import type { FieldTypeValueMap } from './field';
import type { Prettify } from './utils';

/**
 * The content object of a story, typed to a specific component.
 * - `component` is always the literal component name.
 * - `_uid` is always present (assigned by Storyblok, optional in defineStory input).
 * - All other keys come from the component schema, typed to their value shapes.
 */
export type StoryContent<TComponent extends Component = Component> = Prettify<
  { component: TComponent['name']; _uid?: string } &
  {
    [K in keyof TComponent['schema']]: FieldTypeValueMap[TComponent['schema'][K]['type']]
  }
>;

/**
 * A Storyblok CAPI story typed to a specific component.
 * Metadata fields are derived from the generated story_capi type.
 * The `content` field is overridden with a component-aware generic.
 */
export type Story<TComponent extends Component = Component> = Prettify<
  Omit<story_capi, 'content'> & {
    content: StoryContent<TComponent>;
  }
>;
