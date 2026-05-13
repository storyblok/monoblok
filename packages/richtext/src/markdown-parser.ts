import MarkdownIt from 'markdown-it';
import { type HTMLParserOptions, htmlToStoryblokRichtext } from './html-parser';

export interface MarkdownParserOptions {
  extensions?: HTMLParserOptions['extensions'];
}

export function markdownToStoryblokRichtext(
  md: string,
  options: MarkdownParserOptions = {},
) {
  const html = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: true }).render(md);
  return htmlToStoryblokRichtext(html, { extensions: options.extensions });
}
export { mapToAttribute } from './extensions/utils';
