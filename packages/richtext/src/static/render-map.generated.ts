// THIS FILE IS AUTO-GENERATED. DO NOT EDIT.
import type { TiptapNodeAttributes } from './index';
/**
 * Render config for Tiptap nodes
 */
export const NODE_RENDER_MAP = {
  paragraph: null,
  doc: null,
  text: null,
  blockquote: null,
  heading: {
    resolve: (attrs: TiptapNodeAttributes['heading']) => `h${attrs?.level || 1}`,
  },
  bullet_list: null,
  ordered_list: null,
  list_item: null,
  code_block: null,
  hard_break: null,
  horizontal_rule: null,
  image: null,
  emoji: null,
  table: null,
  tableRow: null,
  tableCell: null,
  tableHeader: null,
  blok: null,
  details: null,
  detailsContent: null,
  detailsSummary: null,
} as const;
