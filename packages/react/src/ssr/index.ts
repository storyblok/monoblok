// SSR-compatible components (static-safe, no server actions)
export * from '../common';
export { useStoryblokServerRichText } from '../server/richtext';
export { default as StoryblokServerComponent } from '../server/server-component';
export { default as StoryblokServerStory } from '../server/server-story';
export { default as StoryblokServerRichText } from '../server/server-storyblok-richtext-component';

export {
  BlockTypes,
  MarkTypes,
  richTextResolver,
  type StoryblokRichTextImageOptimizationOptions,
  type StoryblokRichTextNode,
  type StoryblokRichTextNodeResolver,
  type StoryblokRichTextNodeTypes,
  type StoryblokRichTextOptions,
  type StoryblokRichTextResolvers,
  TextTypes,
} from '@storyblok/js';
