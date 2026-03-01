import { defaultExtensions } from '../extensions';
import { richTextResolver } from '../richtext';
import { ComponentBlok } from '../extensions/nodes';
import {
  type Extension,
  Mark as TiptapMark,
  Node as TiptapNode,
  type Node as TiptapNodeType,
} from '@tiptap/core';
import type { StoryblokRichTextNode } from '../types';

export interface RichTextDynamicSegment<
  T extends string = string,
> {
  type: T;
  props: Record<string, any>;
  content: string;
}

export type StoryblokExtensionName = keyof typeof defaultExtensions;

export interface SegmentRichTextDynamicOptions {
  supportedSegments?: StoryblokExtensionName[];
}

export function segmentStoryblokRichTextDynamic<
  Supported extends readonly (keyof typeof defaultExtensions)[],
>(
  doc: StoryblokRichTextNode<string>,
  options: { supportedSegments?: Supported } = {},
): RichTextDynamicSegment<Supported[number] | 'blok' | 'html'>[] {
  const supported = options.supportedSegments ?? [];

  const blokGroups: Record<string, any>[] = [];
  const segmentGroups: Record<string, Record<string, any>[]> = {};

  const BLOK_PREFIX = 'SB_INTERNAL_BLOK_';

  const tiptapExtensions: Record<string, Extension | TiptapNodeType | TiptapMark> = {
    blok: ComponentBlok.configure({
      renderComponent: (blok: Record<string, unknown>) => {
        const index = blokGroups.push(blok) - 1;
        return `<!--${BLOK_PREFIX}${index}-->`;
      },
    }),
  };

  // --- Inject dynamic extensions ---
  for (const name of supported) {
    if (name === 'blok') {
      continue;
    }

    const ext = defaultExtensions[name];
    if (!ext) {
      continue;
    }

    segmentGroups[name] = [];

    const isInline = ext.type === 'mark';

    if (isInline) {
      tiptapExtensions[name] = TiptapMark.create({
        name,
        renderHTML({ mark, HTMLAttributes }) {
          const props = { ...HTMLAttributes, ...mark?.attrs };
          const index = segmentGroups[name].push(props) - 1;

          return [
            'span',
            {
              'data-sb-seg': name,
              'data-sb-idx': String(index),
            },
            0, // children will be rendered inside
          ];
        },
      });
    }
    else {
      tiptapExtensions[name] = TiptapNode.create({
        ...ext,
        name,
        renderHTML({ node, HTMLAttributes }) {
          const props = {
            ...(HTMLAttributes ?? {}),
            ...(node?.attrs ?? {}),
          };
          const index = segmentGroups[name].push(props) - 1;

          return [
            'span',
            {
              'data-sb-block-seg': name,
              'data-sb-idx': String(index),
            },
            0, // children will be rendered inside
          ];
        },
      });
    }
  }

  // --- Render HTML ---
  const html = richTextResolver<string>({
    tiptapExtensions,
  }).render(doc);

  // --- Regexes ---
  const blokRegex = new RegExp(
    `<!--${BLOK_PREFIX}(\\d+)-->`,
    'g',
  );

  const blockSegRegex = /<span data-sb-block-seg="([^"]+)" data-sb-idx="(\d+)">([\s\S]*?)<\/span>/g;
  const inlineSegRegex = /<span data-sb-seg="([^"]+)" data-sb-idx="(\d+)">([\s\S]*?)<\/span>/g;

  const segments: RichTextDynamicSegment[] = [];

  function pushHtml(content: string) {
    if (content) {
      segments.push({
        type: 'html',
        props: {},
        content,
      });
    }
  }

  let pos = 0;

  while (pos < html.length) {
    let next:
      | { kind: 'blok' | 'block' | 'inline'; index: number; type: string; start: number; end: number; content?: string }
      | undefined;

    const findNext = (
      regex: RegExp,
      kind: 'blok' | 'block' | 'inline',
    ) => {
      regex.lastIndex = pos;
      const m = regex.exec(html);
      if (!m) {
        return;
      }

      const start = m.index;
      if (!next || start < next.start) {
        if (kind === 'inline') {
          next = {
            kind,
            type: m[1],
            index: Number(m[2]),
            content: m[3],
            start,
            end: start + m[0].length,
          };
        }
        else if (kind === 'block') {
          next = {
            kind,
            type: m[1].toLowerCase(),
            index: Number(m[2]),
            content: m[3],
            start,
            end: start + m[0].length,
          };
        }
        else {
          next = {
            kind,
            type: 'blok',
            index: Number(m[1]),
            start,
            end: start + m[0].length,
          };
        }
      }
    };

    findNext(blokRegex, 'blok');
    findNext(blockSegRegex, 'block');
    findNext(inlineSegRegex, 'inline');

    if (!next) {
      break;
    }

    pushHtml(html.slice(pos, next.start));

    if (next.kind === 'blok') {
      const blok = blokGroups[next.index];
      if (blok) {
        segments.push({
          type: 'blok',
          props: blok,
          content: '',
        });
      }
    }
    else {
      const props = segmentGroups[next.type]?.[next.index] ?? {};
      segments.push({
        type: next.type,
        props,
        content: next.content ?? '',
      });
    }

    pos = next.end;
  }

  pushHtml(html.slice(pos));

  return segments as RichTextDynamicSegment<Supported[number] | 'blok' | 'html'>[];
}
