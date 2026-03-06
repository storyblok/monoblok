import type { Component } from '../../types/component';
import type { Story, StoryCreate, StoryUpdate } from '../types/story';

/**
 * Defines a MAPI story for a given component.
 * Automatically injects `component: component.name` into the content object.
 *
 * @example
 * import { defineStory } from '@storyblok/schema/mapi';
 * const myStory = defineStory(pageComponent, {
 *   content: { headline: 'Hello World!', component: 'page' },
 *   // ... other MAPI story fields
 * });
 */
export const defineStory = <
  TComponent extends Component,
>(
  component: TComponent,
  story: Story<TComponent>,
): Story<TComponent> => ({
  ...story,
  content: {
    ...story.content,
    component: component.name,
  },
});

/**
 * Defines a story creation payload for the MAPI.
 * `name` is required. `content` is typed to the component's schema when provided.
 *
 * @example
 * import { defineStoryCreate } from '@storyblok/schema/mapi';
 * const payload = defineStoryCreate(pageComponent, {
 *   name: 'My Page',
 *   content: { headline: 'Hello World!', component: 'page' },
 * });
 */
export const defineStoryCreate = <
  TComponent extends Component,
>(
  component: TComponent,
  story: StoryCreate<TComponent>,
): StoryCreate<TComponent> => ({
  ...story,
  ...(story.content && {
    content: {
      ...story.content,
      component: component.name,
    },
  }),
});

/**
 * Defines a story update payload for the MAPI.
 * All fields are optional. `content` is typed to the component's schema when provided.
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
  story: StoryUpdate<TComponent>,
): StoryUpdate<TComponent> => ({
  ...story,
  ...(story.content && {
    content: {
      ...story.content,
      component: component.name,
    },
  }),
});
