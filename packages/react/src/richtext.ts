import StoryblokComponent from './core/storyblok-component';
import { createComponentResolver, createRichTextHook } from './core/richtext-hoc';

export const componentResolver = createComponentResolver(StoryblokComponent, {
  isServerContext: false,
});

export const useStoryblokRichText = createRichTextHook(StoryblokComponent, {
  isServerContext: false,
});
