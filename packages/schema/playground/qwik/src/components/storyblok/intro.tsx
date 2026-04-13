import { component$ } from '@builder.io/qwik';
import type { BlockContent } from '@storyblok/schema';
import type { StoryblokTypes } from '~/schema/types';
import type { introBlock } from '../../schema/components/intro';

type IntroContent = BlockContent<typeof introBlock, StoryblokTypes['components']>;

interface IntroProps {
  blok: IntroContent;
}

export const Intro = component$<IntroProps>(({ blok }) => {
  return (
    <section class="px-6 py-20">
      <div class="mx-auto max-w-3xl text-center">
        {blok.eyebrow && (
          <p class="mb-4 text-sm font-semibold tracking-widest text-indigo-600 uppercase">
            {blok.eyebrow}
          </p>
        )}
        <h2 class="mb-8 text-4xl font-bold text-balance text-gray-900">{blok.headline}</h2>
        {blok.body && (
          <div
            class="prose prose-lg mx-auto text-gray-600"
            dangerouslySetInnerHTML={blok.body}
          />
        )}
      </div>
    </section>
  );
});
