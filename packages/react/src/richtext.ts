import StoryblokComponent from './core/storyblok-component';
import { createRichTextHook } from './core/richtext-hoc';

export const useStoryblokRichText = createRichTextHook(StoryblokComponent, {
  isServerContext: false,
});
