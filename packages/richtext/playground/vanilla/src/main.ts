import { renderRichText } from '@storyblok/richtext';
import { markdownToStoryblokRichtext } from '@storyblok/richtext/markdown-parser';
import { htmlToStoryblokRichtext } from '@storyblok/richtext/html-parser';
import type { SbRichTextRenderContext } from '@storyblok/richtext';
import test from '/test.md?url&raw';
import testHTML from '/test.html?url&raw';

const richtextFromMarkdown = markdownToStoryblokRichtext(test, /*  {
  resolvers: {
    [MarkdownTokenTypes.PARAGRAPH]: (_token, children) => {
      return {
        type: BlockTypes.HEADING,
        attrs: { level: 1 },
        content: children,
      };
    },
  },
} */);

const richtextFromHTML = htmlToStoryblokRichtext(testHTML);

const options: SbRichTextRenderContext = {
  // resolvers: {
  //   [BlockTypes.HEADING]: (node: StoryblokRichTextNode<string>, ctx) => {
  //     return ctx.originalResolvers.get(BlockTypes.HEADING)?.(node, ctx) || '';
  //   },
  // },
  // optimizeImages: {
  //   class: 'v-class',
  //   loading: 'lazy',
  //   width: 800,
  //   height: 600,
  //   filters: {
  //     format: 'webp',
  //     blur: 120,
  //   },
  // },
};

const htmlFromRichtextMarkdown = renderRichText(richtextFromMarkdown, options);
const htmlFromRichtextHtml = renderRichText(richtextFromHTML, options);

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <style>
    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding: 24px;
    }

    .panel {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 16px;
      overflow: auto;
    }

    .panel h2 {
      margin-top: 0;
    }

    pre {
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>

  <div class="comparison-grid">
    <div class="panel">
      <h2>HTML from Markdown</h2>
      ${htmlFromRichtextMarkdown}
    </div>

    <div class="panel">
      <h2>HTML from HTML</h2>
      ${htmlFromRichtextHtml}
    </div>

    <div class="panel">
      <h2>Richtext from Markdown</h2>
      <pre>${JSON.stringify(richtextFromMarkdown, null, 2)}</pre>
    </div>

    <div class="panel">
      <h2>Richtext from HTML</h2>
      <pre>${JSON.stringify(richtextFromHTML, null, 2)}</pre>
    </div>
  </div>
`;
