import { component$ } from '@builder.io/qwik';
import { richTextResolver } from '@storyblok/richtext';
import type { StoryblokRichTextDocumentNode } from '@storyblok/richtext';
import type { BlockContent } from '@storyblok/schema';
import type { Components } from '~/schema/schema';
import type { articleBlock } from '../../schema/components/article';

type ArticleContent = BlockContent<typeof articleBlock, Components>;

interface ArticleProps {
  blok: ArticleContent;
}

const { render } = richTextResolver();

export const Article = component$<ArticleProps>(({ blok }) => {
  const formattedDate = blok.publish_date
    ? new Date(blok.publish_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const bodyHtml = blok.body?.content?.length
    ? (render(blok.body as StoryblokRichTextDocumentNode) as string)
    : '';

  return (
    <article class="px-6 py-16">
      <div class="mx-auto max-w-3xl">
        <header class="mb-8">
          {blok.featured && (
            <span class="mb-3 inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 uppercase">
              Featured
            </span>
          )}
          <h2 class="text-4xl leading-tight font-bold text-balance text-gray-900">
            {blok.title}
          </h2>
          <div class="mt-4 flex items-center gap-4 text-sm text-gray-500">
            {blok.author && (
              <span>
                By
                {blok.author}
              </span>
            )}
            {formattedDate && (
              <time dateTime={blok.publish_date ?? undefined}>{formattedDate}</time>
            )}
          </div>
        </header>
        {/* Content from Storyblok's trusted richtext editor, rendered server-side */}
        {bodyHtml && (
          <div
            class="prose prose-lg prose-gray max-w-none"
            dangerouslySetInnerHTML={bodyHtml}
          />
        )}
      </div>
    </article>
  );
});
