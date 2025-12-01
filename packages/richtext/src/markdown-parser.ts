import MarkdownIt from 'markdown-it';
import { type HTMLParserOptions, htmlToStoryblokRichtext } from './html-parser';

export interface MarkdownParserOptions {
  tiptapExtensions?: HTMLParserOptions['tiptapExtensions'];
}

export function markdownToStoryblokRichtext(
  md: string,
  options: MarkdownParserOptions = {},
) {
  const html = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: true }).render(md);
  return htmlToStoryblokRichtext(html, options);
}
