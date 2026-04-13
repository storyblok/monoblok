import { component$ } from '@builder.io/qwik';
import type { BlockContent } from '@storyblok/schema';
import type { Components } from '~/schema/schema';
import type { comparisonTableBlock } from '../../schema/components/comparison-table';

type ComparisonTableContent = BlockContent<typeof comparisonTableBlock, Components>;

interface ComparisonTableProps {
  blok: ComparisonTableContent;
}

export const ComparisonTable = component$<ComparisonTableProps>(({ blok }) => {
  const thead = blok.table?.thead ?? [];
  const tbody = blok.table?.tbody ?? [];

  return (
    <section class="px-6 py-16">
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
        <div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table class="w-full text-left text-sm">
            {thead.length > 0 && (
              <thead class="bg-gray-50">
                <tr>
                  {thead.map((header, i) => (
                    <th
                      key={i}
                      class="px-6 py-4 font-semibold text-gray-900"
                    >
                      {header.value}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody class="divide-y divide-gray-100">
              {tbody.map((row, rowIdx) => (
                <tr key={rowIdx} class="hover:bg-gray-50">
                  {row.body?.map((cell, cellIdx) => (
                    <td key={cellIdx} class="px-6 py-4 text-gray-700">
                      {cell.value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {blok.footnote && (
          <p class="mt-4 text-center text-sm text-gray-500">{blok.footnote}</p>
        )}
      </div>
    </section>
  );
});
