import type { SbRichTextDoc } from '../static/types';

export const text = (
  content: string,
  marks?: SbRichTextDoc['marks'],
): SbRichTextDoc => ({
  type: 'text',
  text: content,
  ...(marks && { marks }),
});

export const linkMark = (
  href: string,
  options: {
    target?: '_blank' | '_self';
    linktype?: 'url' | 'story' | 'email' | 'asset';
    anchor?: string;
    custom?: Record<string, unknown>;
  } = {},
): NonNullable<SbRichTextDoc['marks']>[number] => ({
  type: 'link',
  attrs: {
    href,
    linktype: options.linktype ?? 'url',
    target: options.target ?? null,
    anchor: options.anchor ?? null,
    uuid: null,
    custom: options.custom ?? undefined,
  },
});

export const tableCell = (
  content: string,
  attrs: { colspan?: number; rowspan?: number; colwidth?: number[]; backgroundColor?: string } = {},
): SbRichTextDoc => ({
  type: 'tableCell',
  content: [{ type: 'paragraph', content: [text(content)] }],
  attrs: {
    colspan: attrs.colspan ?? 1,
    rowspan: attrs.rowspan ?? 1,
    ...(attrs.colwidth && { colwidth: attrs.colwidth }),
    ...(attrs.backgroundColor && { backgroundColor: attrs.backgroundColor }),
  },
});

export const tableHeader = (content: string): SbRichTextDoc => ({
  type: 'tableHeader',
  content: [{ type: 'paragraph', content: [text(content)] }],
  attrs: { colspan: 1, rowspan: 1 },
});

export const tableRow = (cells: SbRichTextDoc[]): SbRichTextDoc => ({
  type: 'tableRow',
  content: cells,
});

export const table = (rows: SbRichTextDoc[]): SbRichTextDoc => ({
  type: 'table',
  content: rows,
});
