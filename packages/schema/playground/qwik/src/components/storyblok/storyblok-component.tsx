import { component$ } from '@builder.io/qwik';

import type { BlockContent } from '@storyblok/schema';
import type { StoryblokTypes } from '~/schema/types';
import { Hero } from './hero';
import { Intro } from './intro';
import { Media } from './media';
import { TeaserList } from './teaser-list';

/** Union of all renderable blok content types — root page or any nested block. */
type AnyBlockContent = BlockContent<StoryblokTypes['components'], StoryblokTypes['components']>;

interface StoryblokComponentProps {
  blok: AnyBlockContent;
}

/**
 * Resolves a Storyblok component name to its Qwik component implementation.
 * Add new components here as you create them.
 */
export const StoryblokComponent = component$<StoryblokComponentProps>(({ blok }) => {
  switch (blok.component) {
    case 'page':
      return (
        <>
          {blok.blocks?.map(block => (
            <StoryblokComponent key={block._uid} blok={block} />
          ))}
        </>
      );
    case 'hero':
      return <Hero blok={blok} />;
    case 'intro':
      return <Intro blok={blok} />;
    case 'media':
      return <Media blok={blok} />;
    case 'teaser_list':
      return <TeaserList blok={blok} />;
    default:
      if (import.meta.env.DEV) {
        return (
          <div class="rounded border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Unknown component:
            <br />
            <pre>{JSON.stringify(blok, null, 2)}</pre>
          </div>
        );
      }
      return null;
  }
});
