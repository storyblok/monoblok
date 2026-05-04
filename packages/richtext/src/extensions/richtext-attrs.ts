// ============================================================================
// Node Attribute Types
// ============================================================================

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
  body: Record<string, unknown>[] | null;
  [key: string]: unknown;
}

// ============================================================================
// Mark Attribute Types
// ============================================================================

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

/** Maps node names to their attribute types. */
export interface NodeAttrTypeMap {
  paragraph: ParagraphAttrs;
  heading: HeadingAttrs;
  code_block: CodeBlockAttrs;
  ordered_list: OrderedListAttrs;
  tableCell: TableCellAttrs;
  tableHeader: TableHeaderAttrs;
  image: ImageAttrs;
  emoji: EmojiAttrs;
}

/** Maps mark names to their attribute types. */
export interface MarkAttrTypeMap {
  link: LinkAttrs;
  highlight: HighlightAttrs;
  textStyle: TextStyleAttrs;
  anchor: AnchorAttrs;
  styled: StyledAttrs;
}

/** Runtime keys for NodeAttrTypeMap (type-checked via satisfies). */
export const nodeAttrKeys: (keyof NodeAttrTypeMap)[] = [
  'paragraph',
  'heading',
  'code_block',
  'ordered_list',
  'tableCell',
  'tableHeader',
  'image',
  'emoji',
];

/** Runtime keys for MarkAttrTypeMap (type-checked via satisfies). */
export const markAttrKeys: (keyof MarkAttrTypeMap)[] = [
  'link',
  'highlight',
  'textStyle',
  'anchor',
  'styled',
];
