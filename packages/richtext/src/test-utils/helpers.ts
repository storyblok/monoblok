import type { SbRichTextDoc, SbRichTextNode } from '../static';

export const text = (
  content: string,
  marks?: SbRichTextNode['marks'],
): SbRichTextNode => ({
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
): NonNullable<SbRichTextNode['marks']>[number] => ({
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
  marks?: SbRichTextNode['marks'],
): SbRichTextNode => ({
  type: 'tableCell',
  content: [{ type: 'paragraph', content: [text(content, marks)] }],
  attrs: {
    colspan: attrs.colspan ?? 1,
    rowspan: attrs.rowspan ?? 1,
    ...(attrs.colwidth && { colwidth: attrs.colwidth }),
    ...(attrs.backgroundColor && { backgroundColor: attrs.backgroundColor }),
  },
});

export const tableHeader = (content: string, marks?: SbRichTextNode['marks']): SbRichTextNode => ({
  type: 'tableHeader',
  content: [{ type: 'paragraph', content: [text(content, marks)] }],
  attrs: { colspan: 1, rowspan: 1 },
});

export const tableRow = (cells: SbRichTextNode[]): SbRichTextNode => ({
  type: 'tableRow',
  content: cells,
});

export const table = (rows: SbRichTextNode[]): SbRichTextNode => ({
  type: 'table',
  content: rows,
});
export const doc = (content: SbRichTextNode | SbRichTextNode[]): SbRichTextDoc => ({
  type: 'doc',
  content: Array.isArray(content) ? content : [content],
});
