import { generateJSON } from '@tiptap/html';
import type { SbRichTextDoc } from './static';
import { getStoryblokTiptapExtensions, type HTMLParserOptions } from './extensions';

/**
 * Converts an HTML string into a Storyblok Rich Text JSON document.
 *
 * This function:
 * - Parses the provided HTML using the configured Storyblok Tiptap extensions
 * - Applies custom attribute parsers and style options if provided
 * - Returns a Storyblok-compatible rich text document structure
 *
 * By default, whitespace is not preserved during parsing.
 *
 * @param html - The HTML string to convert.
 * @param options - Optional configuration for parsing behavior and extensions.
 * @param options.extensions - Custom extension configuration, including attribute parsers.
 * @param options.allowCustomAttributes - Whether to allow non-standard attributes.
 * @param options.styleOptions - List of style properties to parse from inline styles.
 * @param options.preserveWhitespace - Whether to preserve whitespace during parsing.
 *
 * @returns A Storyblok Rich Text JSON document.
 *
 * @example
 * const result = htmlToStoryblokRichtext(html, {
 *   extensions: {
 *     image: {
 *       attributeParsers: {
 *         source: mapToAttribute('data-source'),
 *         copyright: mapToAttribute('data-copyright'),
 *       },
 *     },
 *   },
 * });
 *
 * console.log(result);
 */
export function htmlToStoryblokRichtext(
  html: string,
  options?: HTMLParserOptions,
) {
  const allExtensions = getStoryblokTiptapExtensions({
    extensions: options?.extensions,
    enableReporter: true,
    allowCustomAttributes: options?.allowCustomAttributes,
    styleOptions: options?.styleOptions || [],
  });
  return generateJSON(html, Object.values(allExtensions), {
    preserveWhitespace: options?.preserveWhitespace || false,
  }) as SbRichTextDoc;
}
export type { HTMLParserOptions } from './extensions';
export { mapToAttribute } from './extensions/utils';
