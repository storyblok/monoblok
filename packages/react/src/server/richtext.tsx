import StoryblokServerComponent from './server-component';
import { createComponentResolver, createRichTextHook } from '../core/richtext-hoc';

export const componentResolver = createComponentResolver(StoryblokServerComponent, {
  isServerContext: true,
});

export const useStoryblokServerRichText = createRichTextHook(StoryblokServerComponent, {
  isServerContext: true,
});
