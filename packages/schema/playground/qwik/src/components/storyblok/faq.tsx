import { component$ } from '@builder.io/qwik';
import { richTextResolver } from '@storyblok/richtext';
import type { StoryblokRichTextDocumentNode } from '@storyblok/richtext';
import type { BlockContent } from '@storyblok/schema';
import type { Components } from '~/schema/schema';
import type { faqBlock, faqItemBlock } from '../../schema/components/faq';

type FaqContent = BlockContent<typeof faqBlock, Components>;
type FaqItemContent = BlockContent<typeof faqItemBlock, Components>;

interface FaqProps {
  blok: FaqContent;
}

interface FaqItemProps {
  blok: FaqItemContent;
}

const { render } = richTextResolver();

export const FaqItem = component$<FaqItemProps>(({ blok }) => {
  const answerHtml = blok.answer?.content?.length
    ? (render(blok.answer as StoryblokRichTextDocumentNode) as string)
    : '';

  return (
    <details class="group border-b border-gray-200">
      <summary class="flex cursor-pointer items-center justify-between py-5 text-lg font-medium text-gray-900 hover:text-indigo-600">
        {blok.question}
        <span class="ml-4 shrink-0 text-gray-400 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      {/* Content from Storyblok's trusted richtext editor, rendered server-side */}
      {answerHtml && (
        <div
          class="prose prose-gray pb-5"
          dangerouslySetInnerHTML={answerHtml}
        />
      )}
    </details>
  );
});

export const Faq = component$<FaqProps>(({ blok }) => {
  const categories = blok.categories ?? [];

  return (
    <section class="px-6 py-16">
      <div class="mx-auto max-w-3xl">
        {blok.headline && (
          <h2 class="mb-2 text-center text-3xl font-bold text-balance text-gray-900">
            {blok.headline}
          </h2>
        )}
        {categories.length > 0 && (
          <div class="mb-8 flex flex-wrap justify-center gap-2">
            {categories.map(cat => (
              <span
                key={cat}
                class="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
        <div class="divide-y divide-gray-200 border-t border-gray-200">
          {blok.items?.map(item => (
            <FaqItem key={item._uid} blok={item} />
          ))}
        </div>
      </div>
    </section>
  );
});
