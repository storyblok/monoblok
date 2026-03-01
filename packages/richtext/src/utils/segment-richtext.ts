import type { StoryblokRichTextNode, StoryblokRichTextOptions } from '../types';
import { richTextResolver } from '../richtext';
import { ComponentBlok } from '../extensions/nodes';
import type { ISbComponentType } from 'storyblok-js-client';
import { Mark } from '@tiptap/core';

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
export interface RichTextLinkSegment {
  type: 'link';
  link: Record<string, any>;
}
export type RichTextSegment = RichTextHtmlSegment | RichTextBlokSegment | RichTextLinkSegment;

export function segmentStoryblokRichText(
  doc: StoryblokRichTextNode<string>,
  options: StoryblokRichTextOptions<string> = {},
): RichTextSegment[] {
  const segments: RichTextSegment[] = [];

  const blokGroups: SbBlokData[][] = [];
  const linkGroups: Record<string, any>[][] = [];

  const BLOK_PREFIX = 'SB_INTERNAL_BLOK_GROUP_';
  const LINK_PREFIX = 'SB_INTERNAL_LINK_GROUP_';

  // Remove global flag to avoid stateful RegExp issues
  const BLOK_REGEX_SRC = `<!--${BLOK_PREFIX}(\\d+)-->`;
  const LINK_REGEX_SRC = `<!--${LINK_PREFIX}(\\d+)-->`;
  const MARKER_REGEX = new RegExp(
    `<!--${BLOK_PREFIX}\\d+-->|<!--${LINK_PREFIX}\\d+-->`,
    'g',
  );

  const resolver: StoryblokRichTextOptions<string> = {
    ...options,
    tiptapExtensions: {
      blok: ComponentBlok.configure({
        renderComponent: (blok: Record<string, unknown>) => {
          const index = blokGroups.push([blok as SbBlokData]) - 1;
          return `<!--${BLOK_PREFIX}${index}-->`;
        },
      }),
      link: Mark.create({
        name: 'link',
        renderHTML({ mark, HTMLAttributes }) {
          const linkObj = { ...HTMLAttributes, ...mark?.attrs };
          const index = linkGroups.push([linkObj]) - 1;
          return `<!--${LINK_PREFIX}${index}-->`;
        },
      }),
      ...options.tiptapExtensions,
    },
  };

  const html = richTextResolver<string>(resolver).render(doc);

  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Avoid assignment in while condition for linting
  match = MARKER_REGEX.exec(html);
  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push(html.slice(lastIndex, match.index));
    }
    parts.push(match[0]);
    lastIndex = match.index + match[0].length;
    match = MARKER_REGEX.exec(html);
  }

  if (lastIndex < html.length) {
    parts.push(html.slice(lastIndex));
  }

  for (const part of parts) {
    let matchResult: RegExpExecArray | null;

    // Always use a new RegExp instance to avoid state issues
    matchResult = new RegExp(BLOK_REGEX_SRC).exec(part);
    if (matchResult) {
      const groupIndex = Number(matchResult[1]);
      const bloks = blokGroups[groupIndex];
      if (bloks) {
        for (const blok of bloks) {
          segments.push({ type: 'blok', blok });
        }
      }
      continue;
    }

    matchResult = new RegExp(LINK_REGEX_SRC).exec(part);
    if (matchResult) {
      const groupIndex = Number(matchResult[1]);
      const links = linkGroups[groupIndex];
      if (links) {
        for (const link of links) {
          segments.push({ type: 'link', link });
        }
      }
      continue;
    }

    if (part !== '') {
      segments.push({ type: 'html', content: part });
    }
  }

  return segments;
}
