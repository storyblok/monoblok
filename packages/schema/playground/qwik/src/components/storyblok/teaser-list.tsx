import { component$ } from '@builder.io/qwik';
import type { BlokContent } from '@storyblok/schema';
import type { StoryblokTypes } from '~/schema/types';
import { Teaser } from './teaser';
import type { teaserListBlock } from '../../schema/components/teaser-list';

type TeaserListContent = BlokContent<typeof teaserListBlock, StoryblokTypes['components']>;

interface TeaserListProps {
  blok: TeaserListContent;
}

export const TeaserList = component$<TeaserListProps>(({ blok }) => {
  return (
    <section class="px-6 py-16">
      <div class="mx-auto max-w-6xl">
        {blok.headline && (
          <h2 class="mb-10 text-center text-3xl font-bold text-balance text-gray-900">{blok.headline}</h2>
        )}
        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {blok.items?.map(item => (
            <Teaser key={item._uid} blok={item} />
          ))}
        </div>
      </div>
    </section>
  );
});
