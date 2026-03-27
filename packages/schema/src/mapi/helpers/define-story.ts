import type { Component } from '../../types/component';
import type { StoryContentInput } from '../../types/story';
import type { Story, StoryCreate, StoryUpdate } from '../types/story';

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

/**
 * Input type for `defineStory` (MAPI) — only `name` and `content` are required.
 * All API-assigned and safely-defaultable fields are optional.
 */
type StoryInput<TComponent extends Component = Component> = {
  content: StoryContentInput<TComponent>;
  name: string;
} &
Partial<Omit<Story<TComponent>, 'content' | 'name'>>;

type StoryCreateInput<TComponent extends Component = Component> = {
  content: StoryContentInput<TComponent>;
  name: string;
} &
Partial<Omit<StoryCreate<TComponent>, 'content' | 'name'>>;

type StoryUpdateInput<TComponent extends Component = Component> = {
  content?: StoryContentInput<TComponent>;
} &
Partial<Omit<StoryUpdate<TComponent>, 'content'>>;

/**
 * Defines a MAPI story for a given component.
 * Automatically injects `component: component.name` into the content object.
 * API-assigned fields are optional and filled with safe defaults.
 *
 * @example
 * import { defineStory } from '@storyblok/schema/mapi';
 * const myStory = defineStory(pageComponent, {
 *   name: 'My Page',
 *   content: { headline: 'Hello World!' },
 * });
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

/**
 * Defines a story creation payload for the MAPI.
 * Automatically injects `component: component.name` into the content object —
 * no need to spell it out manually.
 *
 * @example
 * import { defineStoryCreate } from '@storyblok/schema/mapi';
 * const payload = defineStoryCreate(pageComponent, {
 *   name: 'My Page',
 *   content: { headline: 'Hello World!' },
 * });
 */
export const defineStoryCreate = <
  TComponent extends Component,
>(
  component: TComponent,
  story: StoryCreateInput<TComponent>,
): StoryCreate<TComponent> => {
  const { content, ...rest } = story;
  return {
    ...rest,
    content: {
      ...content,
      component: component.name,
    },
  };
};

/**
 * Defines a story update payload for the MAPI.
 * Automatically injects `component: component.name` into the content object —
 * no need to spell it out manually.
 *
 * @example
 * import { defineStoryUpdate } from '@storyblok/schema/mapi';
 * const payload = defineStoryUpdate(pageComponent, {
 *   content: { headline: 'Updated!' },
 * });
 */
export const defineStoryUpdate = <
  TComponent extends Component,
>(
  component: TComponent,
  story: StoryUpdateInput<TComponent>,
): StoryUpdate<TComponent> => {
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
};
