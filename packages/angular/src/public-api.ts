/*
 * Public API Surface of angular-storyblok
 */

// Core service and provider
export { StoryblokService, type StoryblokClientConfig } from './lib/storyblok.service';
export { provideStoryblok } from './lib/storyblok.feature';
// Component registry
export { withStoryblokComponents, type StoryblokComponentsMap } from './lib/components.feature';

// Live Preview feature (optional, tree-shakeable)
export { LivePreviewService } from './lib/livepreview/livepreview.service';
export { withLivePreview } from './lib/livepreview/livepreview.feature';
export { type BridgeParams } from '@storyblok/live-preview';

// Storyblok Component
export { StoryblokComponent } from './lib/blok/sb-component.component';

// Directive
export { SbBlokDirective } from './lib/blok/sb-blok.directive';

// Rich Text (with custom component overrides)
export { SbRichTextComponent } from './lib/richtext/rich-text.component';
export { withStoryblokRichtextComponents } from './lib/richtext/richtext.feature';
export type { SbAngularComponentMap } from './lib/richtext/richtext.feature';
// Re-export richtext types for convenience
export { type SbRichTextDoc } from '@storyblok/richtext/static';

export type { Story } from '@storyblok/api-client';
export * from './lib/types';
