/*
 * Public API Surface of angular-storyblok
 */

// Core service and provider
export { StoryblokService, STORYBLOK_CONFIG } from './lib/storyblok.service';
export { provideStoryblok } from './lib/storyblok.feature';
// Component registry
export {
  STORYBLOK_COMPONENTS,
  withStoryblokComponents,
  isComponentLoader,
} from './lib/storyblok-components';
export type { StoryblokComponentsMap, StoryblokComponentLoader } from './lib/storyblok-components';

// Live Preview feature (optional, tree-shakeable)
export { LivePreviewService } from './lib/livepreview.service';
export { withLivePreview } from './lib/livepreview.feature';

export type { LivePreviewCallback } from './lib/livepreview.service';

// Directive
export { SbBlokDirective } from './lib/sb-blok.directive';

// Rich Text
export { SbRichTextComponent } from './lib/richtext.component';

// Re-export richtext types for convenience
export {
  richTextResolver,
  BlockTypes,
  MarkTypes,
  type StoryblokRichTextNode,
  type StoryblokRichTextOptions,
} from '@storyblok/richtext';

// Re-export useful types from @storyblok/js
export type {
  ISbStoriesParams,
  ISbStoryData,
  ISbResult,
  ISbStory,
  ISbConfig,
  ISbComponentType,
} from 'storyblok-js-client';

export type { SbBlokData } from '@storyblok/js';
