import MarkdownIt from 'markdown-it';
import { type HTMLParserOptions, htmlToStoryblokRichtext } from './html-parser';

export interface MarkdownParserOptions {
  parsers?: HTMLParserOptions['parsers'];
}

export function markdownToStoryblokRichtext(
  md: string,
  options: MarkdownParserOptions = {},
) {
  const html = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: true }).render(md);
  return htmlToStoryblokRichtext(html, { parsers: options.parsers });
}
export { mapToAttribute } from './extensions/utils';
