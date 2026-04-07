/*
 * Public API Surface of angular-storyblok
 */

// Core service and provider
export { StoryblokService, type StoryblokClientConfig } from './lib/storyblok.service';
export { provideStoryblok } from './lib/storyblok.feature';
// Component registry
export { withStoryblokComponents } from './lib/components.feature';
export type { StoryblokComponentsMap } from './lib/components.feature';

// Live Preview feature (optional, tree-shakeable)
export { LivePreviewService } from './lib/livepreview.service';
export { withLivePreview } from './lib/livepreview.feature';

// Directive
export { SbBlokDirective } from './lib/sb-blok.directive';

// Rich Text (AST-based with custom component overrides)
export { SbRichTextComponent } from './lib/rich-text.component';
export { SbRichTextNodeComponent } from './lib/rich-text-node.component';
export { StoryblokRichtextResolver, withStoryblokRichtextComponents } from './lib/richtext.feature';
export type { StoryblokRichtextComponentsMap, AngularRenderNode } from './lib/richtext.feature';

// Re-export richtext types for convenience
export {
  richTextResolver,
  type StoryblokRichTextNode,
  type StoryblokRichTextOptions,
} from '@storyblok/richtext';

export * from './lib/types';
export type { Story } from '@storyblok/api-client';
