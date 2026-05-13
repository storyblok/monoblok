import type { MarkSpec, NodeSpec } from 'prosemirror-model';
import type { SbBlokData } from '../static/types';
import type { TiptapMarkName, TiptapNodeName } from '../static/types.generated';

/** For node and mark that do not have any attribute support */
export type NoAttrs = Record<string, never>;

/** Node Attributes */

export interface ParagraphAttrs {
  textAlign: 'left' | 'center' | 'right' | 'justify' | null;
  [key: string]: unknown;
}

export interface HeadingAttrs {
  textAlign: 'left' | 'center' | 'right' | 'justify' | null;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  [key: string]: unknown;
}

export interface CodeBlockAttrs {
  class: string | null;
  [key: string]: unknown;
}

export interface OrderedListAttrs {
  order?: number;
  [key: string]: unknown;
}

export interface TableCellAttrs {
  colspan?: number;
  rowspan?: number;
  colwidth?: number[] | null;
  backgroundColor?: string | null;
  [key: string]: unknown;
}

export interface TableHeaderAttrs {
  colspan?: number;
  rowspan?: number;
  colwidth?: number[] | null;
  [key: string]: unknown;
}

export interface ImageAttrs {
  id: number | null;
  alt: string | null;
  src: string;
  title: string | null;
  source: string | null;
  copyright: string | null;
  meta_data: {
    alt: string | null;
    title: string | null;
    source: string | null;
    copyright: string | null;
  } | null;
  [key: string]: unknown;
}

export interface EmojiAttrs {
  name: string;
  emoji: string;
  fallbackImage: string;
  [key: string]: unknown;
}

export interface BlokAttrs {
  id: string | null;
  body: SbBlokData[] | null;
  [key: string]: unknown;
}

/** Mark Attributes */

export interface LinkAttrs {
  href: string | null;
  uuid: string | null;
  anchor: string | null;
  target: '_self' | '_blank' | '_parent' | '_top' | null;
  linktype: 'story' | 'url' | 'email' | 'asset' | null;
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface HighlightAttrs {
  color: string;
  [key: string]: unknown;
}

export interface TextStyleAttrs {
  color?: string | null;
  id?: string | null;
  class?: string | null;
  [key: string]: unknown;
}

export interface AnchorAttrs {
  id: string;
  [key: string]: unknown;
}

export interface StyledAttrs {
  class: string | null;
  [key: string]: unknown;
}

/** Attribute Maps */

export const nodeAttrMap = {
  paragraph: {} as ParagraphAttrs,
  heading: {} as HeadingAttrs,
  code_block: {} as CodeBlockAttrs,
  ordered_list: {} as OrderedListAttrs,
  tableCell: {} as TableCellAttrs,
  tableHeader: {} as TableHeaderAttrs,
  image: {} as ImageAttrs,
  emoji: {} as EmojiAttrs,
  blok: {} as BlokAttrs,
  doc: {} as NoAttrs,
  text: {} as NoAttrs,
  blockquote: {} as NoAttrs,
  bullet_list: {} as NoAttrs,
  list_item: {} as NoAttrs,
  hard_break: {} as NoAttrs,
  horizontal_rule: {} as NoAttrs,
  table: {} as NoAttrs,
  tableRow: {} as NoAttrs,
  details: {} as NoAttrs,
  detailsContent: {} as NoAttrs,
  detailsSummary: {} as NoAttrs,
} satisfies Record<TiptapNodeName, unknown>;

export type NodeAttrTypeMap = typeof nodeAttrMap;

export const markAttrMap = {
  link: {} as LinkAttrs,
  highlight: {} as HighlightAttrs,
  textStyle: {} as TextStyleAttrs,
  anchor: {} as AnchorAttrs,
  styled: {} as StyledAttrs,
  superscript: {} as NoAttrs,
  subscript: {} as NoAttrs,
  bold: {} as NoAttrs,
  italic: {} as NoAttrs,
  strike: {} as NoAttrs,
  underline: {} as NoAttrs,
  code: {} as NoAttrs,
} satisfies Record<TiptapMarkName, unknown>;

export type MarkAttrTypeMap = typeof markAttrMap;

export type ExtensionAttrMap = Exclude<NodeAttrTypeMap & MarkAttrTypeMap, 'reporter'>;
export type ExtensionKey = keyof ExtensionAttrMap;
export type ExtensionAttrs<K extends ExtensionKey> = ExtensionAttrMap[K];

export const allAttrKeys = [
  ...Object.keys(nodeAttrMap),
  ...Object.keys(markAttrMap),
] as ExtensionKey[];

/** Conditional typing for Node vs Mark */

type ParseHTMLReturn<T extends ExtensionKey> =
  T extends keyof NodeAttrTypeMap
    ? NonNullable<NodeSpec['parseDOM']>
    : T extends keyof MarkAttrTypeMap
      ? NonNullable<MarkSpec['parseDOM']>
      : never;

/** Extension Options */
export interface ExtensionOptions<K extends ExtensionKey> {
  parseHTML?: () => ParseHTMLReturn<K> | undefined;

  attributeParsers?: Partial<{
    [P in keyof ExtensionAttrs<K>]: (
      el: HTMLElement
    ) => ExtensionAttrs<K>[P] | null | undefined;
  }>;
}
