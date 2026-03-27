import type { Component } from '../types/component';
import type { Story, StoryContentInput } from '../types/story';

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

/**
 * Input type for `defineStory` — all API-assigned and safely-defaultable fields are optional.
 */
type StoryInput<
  TComponent extends Component = Component,
  TSchema extends Component = never,
> = {
  content: StoryContentInput<TComponent, TSchema>;
  name: string;
} & Partial<Omit<Story<TComponent, TSchema>, 'content' | 'name'>>;

/**
 * Defines a CAPI story for a given component.
 * Automatically injects `component: component.name` into the content object.
 * API-assigned fields are optional and filled with safe defaults.
 * The content type is constrained to the component's schema — wrong value types
 * and extra keys produce TypeScript errors.
 *
 * For MAPI stories, use `defineStory` from `@storyblok/schema/mapi`.
 *
 * @example
 * const myStory = defineStory(pageComponent, {
 *   name: 'Home',
 *   content: { headline: 'Hello World!' },
 * });
 * // myStory.content.component === 'page' (inferred)
 */
export const defineStory = <
  TComponent extends Component,
>(
  component: TComponent,
  story: StoryInput<TComponent>,
): Story<TComponent> => {
  const { content, ...rest } = story;
  return {
    ...STORY_DEFAULTS,
    ...rest,
    content: {
      ...content,
      component: component.name,
    },
  };
};
