import {
  richTextResolver,
  BlockTypes,
  type StoryblokRichTextNode,
  type StoryblokRichTextOptions,
} from '@storyblok/richtext';
import type { SbBlokData } from '@storyblok/js';

export type RichTextHtmlSegment = {
  type: 'html';
  content: string;
};
export type RichTextBlokSegment = {
  type: 'blok';
  blok: SbBlokData;
};
export type RichTextSegment = RichTextHtmlSegment | RichTextBlokSegment;

const BLOK_MARKER_PREFIX = 'SB_BLOK_GROUP_';
const BLOK_MARKER_REGEX = /<!--SB_BLOK_GROUP_(\d+)-->/;

export function parseStoryblokRichText(
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
        const body = node.attrs?.['body'];
        if (!Array.isArray(body) || body.length === 0) return '';
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
    } else {
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
