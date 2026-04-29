import { component$ } from '@builder.io/qwik';
import { marked } from 'marked';
import type { BlockContent } from '@storyblok/schema';
import type { StoryblokTypes } from '~/schema/types';
import type { mediaBlock } from '../../schema/components/media';

type MediaContent = BlockContent<typeof mediaBlock, StoryblokTypes['components']>;

interface MediaProps {
  blok: MediaContent;
}

export const Media = component$<MediaProps>(({ blok }) => {
  if (!blok.image?.filename) {
    return null;
  }

  return (
    <section class="px-6 py-12">
      <div class="mx-auto max-w-5xl lg:flex lg:items-start lg:gap-12">
        <figure class="lg:w-1/2">
          <div class="overflow-hidden rounded-2xl shadow-xl">
            <img
              src={blok.image.filename}
              alt={blok.image.alt ?? ''}
              class="h-auto w-full object-cover"
              width="1200"
              height="675"
            />
          </div>
          {blok.caption && (
            <figcaption class="mt-3 text-sm text-gray-500">{blok.caption}</figcaption>
          )}
        </figure>
        {blok.text && (
          <div
            class="prose prose-lg mt-8 text-gray-600 lg:mt-0 lg:w-1/2"
            dangerouslySetInnerHTML={marked.parse(blok.text) as string}
          />
        )}
      </div>
    </section>
  );
});
