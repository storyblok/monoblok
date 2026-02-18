import { BlockTypes, type StoryblokRichTextNode, type StoryblokRichTextOptions } from '../types';
import { richTextResolver } from '../richtext';
import type { ISbComponentType } from 'storyblok-js-client';

export type SbBlokKeyDataTypes = string | number | object | boolean | undefined;

export interface SbBlokData extends ISbComponentType<string> {
  [index: string]: SbBlokKeyDataTypes;
}
export interface RichTextHtmlSegment {
  type: 'html';
  content: string;
}
export interface RichTextBlokSegment {
  type: 'blok';
  blok: SbBlokData;
};
export type RichTextSegment = RichTextHtmlSegment | RichTextBlokSegment;

const BLOK_MARKER_PREFIX = 'SB_BLOK_GROUP_';
const BLOK_MARKER_REGEX = /<!--SB_BLOK_GROUP_(\d+)-->/;

/**
 * Converts a Storyblok Rich Text document into a linear list of segments.
 *
 * The returned segments preserve the original content order and consist of:
 * - HTML segments for regular rich text content
 * - Blok segments for embedded Storyblok components
 *
 * This allows consumers to render HTML normally while handling Storyblok
 * components separately using framework-specific logic.
 *
 * @param doc - The Storyblok Rich Text document to process
 * @param options - Optional rich text resolver options
 * @returns An ordered array of rich text segments (HTML and bloks)
 *
 * @example
 * ```ts
 * const segments = segmentStoryblokRichText(richTextDoc);
 *
 * for (const segment of segments) {
 *   if (segment.type === 'html') {
 *     renderHtml(segment.content);
 *   }
 *
 *   if (segment.type === 'blok') {
 *     renderBlokComponent(segment.blok);
 *   }
 * }
 * ```
 */
export function segmentStoryblokRichText(
  doc: StoryblokRichTextNode<string>,
  options: StoryblokRichTextOptions<string> = {},
): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  const blokGroups: SbBlokData[][] = [];
  const resolver: StoryblokRichTextOptions<string> = {
    ...options,
    resolvers: {
      ...options.resolvers,
      [BlockTypes.COMPONENT]: (node) => {
        const body = node.attrs?.body;
        if (!Array.isArray(body) || body.length === 0) {
          return '';
        }
        const index = blokGroups.push(body as SbBlokData[]) - 1;
        return `<!--${BLOK_MARKER_PREFIX}${index}-->`;
      },
    },
  };
  const html = richTextResolver<string>(resolver).render(doc);
  const parts = html.split(BLOK_MARKER_REGEX);

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const htmlPart = parts[i];
      if (htmlPart && htmlPart.trim()) {
        segments.push({ type: 'html', content: htmlPart });
      }
    }
    else {
      const groupIndex = Number(parts[i]);
      const bloks = blokGroups[groupIndex];
      if (bloks) {
        for (const blok of bloks) {
          segments.push({ type: 'blok', blok });
        }
      }
    }
  }
  return segments;
}
