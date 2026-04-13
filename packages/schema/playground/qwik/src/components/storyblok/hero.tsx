import { component$ } from '@builder.io/qwik';
import type { BlockContent } from '@storyblok/schema';
import type { StoryblokTypes } from '~/schema/types';
import type { heroBlock } from '../../schema/components/hero';

type HeroContent = BlockContent<typeof heroBlock, StoryblokTypes['components']>;

interface HeroProps {
  blok: HeroContent;
}

export const Hero = component$<HeroProps>(({ blok }) => {
  return (
    <section class="relative flex min-h-[60vh] items-center bg-gray-900 px-6 py-24 text-white">
      <div class="mx-auto max-w-4xl">
        {blok.eyebrow && (
          <p class="mb-4 text-sm font-semibold tracking-widest text-indigo-400 uppercase">
            {blok.eyebrow}
          </p>
        )}
        <h1 class="text-5xl leading-tight font-bold text-balance md:text-6xl">{blok.headline}</h1>
        {blok.image?.filename && (
          <img
            src={blok.image.filename}
            alt={blok.image.alt ?? ''}
            class="mt-10 rounded-xl object-cover shadow-lg"
            width="1200"
            height="630"
          />
        )}
      </div>
    </section>
  );
});
