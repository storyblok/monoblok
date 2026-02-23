import StoryblokServerComponent from './server-component';
import { createRichTextHook } from '../core/richtext-hoc';

export const useStoryblokServerRichText = createRichTextHook(StoryblokServerComponent, {
  isServerContext: true,
});
