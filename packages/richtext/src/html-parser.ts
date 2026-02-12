import { generateJSON } from '@tiptap/html';
import type { StoryblokRichTextDocumentNode } from './types';
import { getStoryblokExtensions } from './extensions';
import type { HTMLParserOptions } from './extensions';

export type { HTMLParserOptions, StyleOption } from './extensions';
export type { StyledOptions } from './extensions/marks';

export function htmlToStoryblokRichtext(
  html: string,
  options: HTMLParserOptions = {},
) {
  const { preserveWhitespace, tiptapExtensions, ...extensionOptions } = options;
  const allExtensions = getStoryblokExtensions(extensionOptions);

  const finalExtensions = tiptapExtensions
    ? { ...allExtensions, ...tiptapExtensions }
    : allExtensions;

  return generateJSON(html, Object.values(finalExtensions), {
    preserveWhitespace: preserveWhitespace || false,
  }) as StoryblokRichTextDocumentNode;
}
