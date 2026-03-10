/*
 * Public API Surface of angular-storyblok
 */

// Core service and provider
export {
  StoryblokService,
  STORYBLOK_CONFIG,
  type StoryblokClientConfig,
} from './lib/storyblok.service';
export { provideStoryblok } from './lib/storyblok.feature';
// Component registry
export {
  STORYBLOK_COMPONENTS,
  withStoryblokComponents,
  isComponentLoader,
} from './lib/components.feature';
export type { StoryblokComponentsMap, StoryblokComponentLoader } from './lib/components.feature';

// Live Preview feature (optional, tree-shakeable)
export { LivePreviewService } from './lib/livepreview.service';
export { withLivePreview } from './lib/livepreview.feature';

export type { LivePreviewCallback } from './lib/livepreview.service';

// Directive
export { SbBlokDirective } from './lib/sb-blok.directive';

// Rich Text (AST-based with custom component overrides)
export { RichTextComponent } from './lib/rich-text.component';
export { RichTextNodeComponent } from './lib/rich-text-node.component';
export {
  STORYBLOK_RICHTEXT_COMPONENTS,
  withStoryblokRichtextComponents,
  createAngularAdapter,
  isTextNode,
  isTagNode,
  isComponentNode,
} from './lib/richtext.feature';
export type {
  StoryblokRichtextComponentsMap,
  AngularRenderNode,
  AngularTextNode,
  AngularTagNode,
  AngularComponentNode,
} from './lib/richtext.feature';

// Re-export richtext types for convenience
export {
  richTextResolver,
  BlockTypes,
  MarkTypes,
  type StoryblokRichTextNode,
  type StoryblokRichTextOptions,
} from '@storyblok/richtext';

export type { SbBlokData, ISbStoryData } from '@storyblok/js';

export type { Story } from '@storyblok/api-client';
