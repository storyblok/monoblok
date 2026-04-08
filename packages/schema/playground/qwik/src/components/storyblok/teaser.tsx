import { component$ } from '@builder.io/qwik';
import type { BlokContent } from '@storyblok/schema';
import type { StoryblokTypes } from '~/schema/types';
import type { teaserBlock } from '../../schema/components/teaser';

type TeaserContent = BlokContent<typeof teaserBlock, StoryblokTypes['components']>;

interface TeaserProps {
  blok: TeaserContent;
}

export const Teaser = component$<TeaserProps>(({ blok }) => {
  const href
    = blok.link?.linktype === 'story'
      ? `/${blok.link.cached_url ?? ''}`
      : blok.link?.url ?? undefined;

  return (
    <article class="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {blok.image?.filename && (
        <div class="aspect-video overflow-hidden">
          <img
            src={blok.image.filename}
            alt={blok.image.alt ?? ''}
            class="h-full w-full object-cover"
            width="600"
            height="337"
          />
        </div>
      )}
      <div class="flex flex-1 flex-col p-6">
        <h3 class="mb-2 text-xl font-semibold text-balance text-gray-900">{blok.title}</h3>
        {blok.description && <p class="flex-1 text-gray-600">{blok.description}</p>}
        {href && (
          <a
            href={href}
            class="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            Learn more &rarr;
          </a>
        )}
      </div>
    </article>
  );
});
