import type { Component } from '../types/component';
import type { Story } from '../types/story';

/**
 * Defines a CAPI story for a given component.
 * Automatically injects `component: component.name` into the content object.
 * The content type is constrained to the component's schema — wrong value types
 * and extra keys produce TypeScript errors.
 *
 * For MAPI stories, use `defineStory` from `@storyblok/schema/mapi`.
 *
 * @example
 * const myStory = defineStory(pageComponent, {
 *   content: { headline: 'Hello World!' },
 * });
 * // myStory.content.component === 'page' (inferred)
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
