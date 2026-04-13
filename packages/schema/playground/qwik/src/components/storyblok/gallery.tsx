import { component$ } from '@builder.io/qwik';
import type { BlockContent } from '@storyblok/schema';
import type { Components } from '~/schema/schema';
import type { galleryBlock } from '../../schema/components/gallery';

type GalleryContent = BlockContent<typeof galleryBlock, Components>;

interface GalleryProps {
  blok: GalleryContent;
}

const columnClasses: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export const Gallery = component$<GalleryProps>(({ blok }) => {
  const cols = blok.columns || 3;
  const gridClass = columnClasses[cols] ?? columnClasses[3];

  return (
    <section class="px-6 py-16">
      <div class="mx-auto max-w-6xl">
        {blok.headline && (
          <h2 class="mb-10 text-center text-3xl font-bold text-balance text-gray-900">
            {blok.headline}
          </h2>
        )}
        <div class={`grid gap-6 ${gridClass}`}>
          {blok.images?.map(image => (
            <figure key={image.id} class="overflow-hidden rounded-xl shadow-sm">
              <img
                src={image.filename}
                alt={image.alt ?? ''}
                class="aspect-video w-full object-cover"
                width="600"
                height="337"
              />
              {blok.show_captions && image.alt && (
                <figcaption class="bg-gray-50 px-4 py-2 text-sm text-gray-600">
                  {image.alt}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
});
