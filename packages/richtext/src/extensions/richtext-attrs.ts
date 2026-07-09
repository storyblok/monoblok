import type { MarkSpec, NodeSpec } from 'prosemirror-model';
import type { SbBlokData } from '../static/types';
import type { TiptapMarkName, TiptapNodeName } from '../static/types.generated';
import type {
  RichtextFieldValueAnchorMark,
  RichtextFieldValueBlokNode,
  RichtextFieldValueCodeBlockNode,
  RichtextFieldValueEmojiNode,
  RichtextFieldValueHeadingNode,
  RichtextFieldValueHighlightMark,
  RichtextFieldValueImageNode,
  RichtextFieldValueLinkMark,
  RichtextFieldValueOrderedListNode,
  RichtextFieldValueParagraphNode,
  RichtextFieldValueStyledMark,
  RichtextFieldValueTableCellNode,
  RichtextFieldValueTableHeaderNode,
  RichtextFieldValueTextStyleMark,
} from '../generated/overlay/types.gen';

/** For node and mark that do not have any attribute support */
export type NoAttrs = Record<string, unknown>;

/** Node Attributes — derived from OpenAPI-generated types so they stay in sync automatically. */

export type ParagraphAttrs = RichtextFieldValueParagraphNode['attrs'] & Record<string, unknown>;
export type HeadingAttrs = RichtextFieldValueHeadingNode['attrs'] & Record<string, unknown>;
export type CodeBlockAttrs = RichtextFieldValueCodeBlockNode['attrs'] & Record<string, unknown>;
export type OrderedListAttrs = RichtextFieldValueOrderedListNode['attrs'] & Record<string, unknown>;
export type TableCellAttrs = RichtextFieldValueTableCellNode['attrs'] & Record<string, unknown>;
export type TableHeaderAttrs = RichtextFieldValueTableHeaderNode['attrs'] & Record<string, unknown>;
export type ImageAttrs = RichtextFieldValueImageNode['attrs'] & Record<string, unknown>;
export type EmojiAttrs = RichtextFieldValueEmojiNode['attrs'] & Record<string, unknown>;

/**
 * BlokAttrs keeps `body` typed as `SbBlokData[]` (the repo-wide blok type) rather
 * than the inline shape from the generated spec, which is structurally equivalent
 * but less convenient to work with.
 */
export type BlokAttrs = Omit<RichtextFieldValueBlokNode['attrs'], 'body'> & {
  body: SbBlokData[] | null;
} & Record<string, unknown>;

/** Mark Attributes — derived from OpenAPI-generated types. */

export type LinkAttrs = RichtextFieldValueLinkMark['attrs'] & Record<string, unknown>;
export type HighlightAttrs = RichtextFieldValueHighlightMark['attrs'] & Record<string, unknown>;
export type TextStyleAttrs = RichtextFieldValueTextStyleMark['attrs'] & Record<string, unknown>;
export type AnchorAttrs = RichtextFieldValueAnchorMark['attrs'] & Record<string, unknown>;
export type StyledAttrs = RichtextFieldValueStyledMark['attrs'] & Record<string, unknown>;

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
