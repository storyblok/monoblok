import type { Story } from '@storyblok/api-client';
import type { heroBlock } from './components/hero';
import type { introBlock } from './components/intro';
import type { mediaBlock } from './components/media';
import type { pageBlock } from './components/page';
import type { teaserBlock } from './components/teaser';
import type { teaserListBlock } from './components/teaser-list';

/**
 * Union of all Storyblok component definitions.
 * Used to provide type-safe access in both capi and mapi clients.
 */
export interface StoryblokTypes {
  components:
    | typeof pageBlock
    | typeof heroBlock
    | typeof introBlock
    | typeof mediaBlock
    | typeof teaserListBlock
    | typeof teaserBlock;
}

/** A Storyblok story typed to the full app schema (discriminated union over all components). */
export type AppStory = Story<StoryblokTypes['components']>;
