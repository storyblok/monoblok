import { component$ } from '@builder.io/qwik';
import type { BlockContent } from '@storyblok/schema';
import type { Components } from '~/schema/schema';
import type { statItemBlock, statsBlock } from '../../schema/components/stats';

type StatsContent = BlockContent<typeof statsBlock, Components>;
type StatItemContent = BlockContent<typeof statItemBlock, Components>;

interface StatsProps {
  blok: StatsContent;
}

interface StatItemProps {
  blok: StatItemContent;
}

export const StatItem = component$<StatItemProps>(({ blok }) => {
  return (
    <div class="text-center">
      <div class="text-4xl font-bold text-indigo-600">
        {blok.prefix}
        {blok.value}
        {blok.suffix}
      </div>
      <div class="mt-2 text-sm font-medium text-gray-600">{blok.label}</div>
    </div>
  );
});

export const Stats = component$<StatsProps>(({ blok }) => {
  return (
    <section class="bg-gray-50 px-6 py-16">
      <div class="mx-auto max-w-5xl">
        {blok.headline && (
          <h2 class="mb-2 text-center text-3xl font-bold text-balance text-gray-900">
            {blok.headline}
          </h2>
        )}
        {blok.description && (
          <p class="mx-auto mb-10 max-w-2xl text-center text-gray-600">
            {blok.description}
          </p>
        )}
        <div class="grid grid-cols-2 gap-8 md:grid-cols-4">
          {blok.items?.map(item => (
            <StatItem key={item._uid} blok={item} />
          ))}
        </div>
      </div>
    </section>
  );
});
