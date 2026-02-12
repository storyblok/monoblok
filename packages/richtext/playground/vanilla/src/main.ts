import { richTextResolver } from '@storyblok/richtext';
import { markdownToStoryblokRichtext } from '@storyblok/richtext/markdown-parser';
import { htmlToStoryblokRichtext } from '@storyblok/richtext/html-parser';
import type { StoryblokRichTextOptions } from '@storyblok/richtext';
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

// eslint-disable-next-line no-console
console.log({ richtextFromMarkdown });

const richtextFromHTML = htmlToStoryblokRichtext(testHTML);

// eslint-disable-next-line no-console
console.log({ richtextFromHTML });

const options: StoryblokRichTextOptions<string> = {
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

const htmlFromRichtextMarkdown = richTextResolver(options).render(richtextFromMarkdown);
const htmlFromRichtextHtml = richTextResolver(options).render(richtextFromHTML);

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="this-div-is-on-purpose">
  ${htmlFromRichtextMarkdown}
  <br>
  <br>
  <hr />
  <hr />
  <hr />
  <hr />
  <br>
  <br>
  ${htmlFromRichtextHtml}
  <br>
  <br>
  <hr />
  <hr />
  <hr />
  <hr />
  <hr />
  <br>
  <br>
  <pre>${JSON.stringify(richtextFromMarkdown, null, 2)}</pre>
  <br>
  <br>
  <hr />
  <hr />
  <hr />
  <hr />
  <hr />
  <br>
  <br>
  <pre>${JSON.stringify(richtextFromHTML, null, 2)}</pre>
  </div>
`;
