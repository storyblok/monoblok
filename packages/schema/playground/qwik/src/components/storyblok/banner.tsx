import { component$ } from '@builder.io/qwik';
import type { BlockContent } from '@storyblok/schema';
import type { Components } from '~/schema/schema';
import type { bannerBlock } from '../../schema/components/banner';

type BannerContent = BlockContent<typeof bannerBlock, Components>;

interface BannerProps {
  blok: BannerContent;
}

const themeStyles: Record<string, string> = {
  light: 'bg-gray-50 text-gray-900',
  dark: 'bg-gray-900 text-white',
  brand: 'bg-indigo-600 text-white',
  gradient: 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white',
};

export const Banner = component$<BannerProps>(({ blok }) => {
  const theme = blok.theme || 'light';
  const classes = themeStyles[theme] ?? themeStyles.light;

  const href
    = blok.cta_link?.linktype === 'story'
      ? `/${blok.cta_link.cached_url ?? ''}`
      : blok.cta_link?.url ?? undefined;

  return (
    <section
      class={`relative overflow-hidden px-6 py-20 ${classes}`}
      style={
        blok.background_image?.filename
          ? {
              backgroundImage: `url(${blok.background_image.filename})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {blok.background_image?.filename && (
        <div class="absolute inset-0 bg-black/40" />
      )}
      <div class="relative mx-auto max-w-4xl text-center">
        <h2 class="text-4xl leading-tight font-bold text-balance md:text-5xl">
          {blok.headline}
        </h2>
        {blok.subline && (
          <p class="mx-auto mt-4 max-w-2xl text-lg opacity-90">{blok.subline}</p>
        )}
        {blok.show_cta && blok.cta_label && href && (
          <a
            href={href}
            class="mt-8 inline-block rounded-lg bg-white px-8 py-3 font-semibold text-gray-900 shadow-lg transition-transform hover:scale-105"
          >
            {blok.cta_label}
          </a>
        )}
      </div>
    </section>
  );
});
