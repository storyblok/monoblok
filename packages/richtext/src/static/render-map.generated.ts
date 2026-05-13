// THIS FILE IS AUTO-GENERATED. DO NOT EDIT.
import { resolveHeadingTag } from './dynamic-resolvers';
/**
 * Render config for Tiptap nodes
 */
export const NODE_RENDER_MAP = {
  paragraph: {
    tag: 'p',
    content: true,
  },
  doc: null,
  text: null,
  emoji: {
    tag: 'img',
    attrs: {
      style: 'width: 1.25em; height: 1.25em; vertical-align: text-top;',
      draggable: 'false',
      loading: 'lazy',
    },
  },
  blockquote: {
    tag: 'blockquote',
    content: true,
  },
  heading: {
    resolve: resolveHeadingTag,
  },
  bullet_list: {
    tag: 'ul',
    content: true,
  },
  ordered_list: {
    tag: 'ol',
    attrs: {
      order: 1,
    },
    content: true,
  },
  list_item: {
    tag: 'li',
    content: true,
  },
  code_block: {
    tag: 'pre',
    children: [
      {
        tag: 'code',
        content: true,
      },
    ],
  },
  hard_break: {
    tag: 'br',
  },
  horizontal_rule: {
    tag: 'hr',
  },
  image: {
    tag: 'img',
  },
  table: {
    tag: 'table',
    content: true,
  },
  tableRow: {
    tag: 'tr',
    content: true,
  },
  tableCell: {
    tag: 'td',
    attrs: {
      colspan: 1,
      rowspan: 1,
    },
    content: true,
  },
  tableHeader: {
    tag: 'th',
    attrs: {
      colspan: 1,
      rowspan: 1,
    },
    content: true,
  },
  blok: null,
} as const;

/**
 * Render config for Tiptap marks
 */
export const MARK_RENDER_MAP = {
  link: {
    tag: 'a',
    content: true,
  },
  bold: {
    tag: 'strong',
    content: true,
  },
  italic: {
    tag: 'em',
    content: true,
  },
  strike: {
    tag: 's',
    content: true,
  },
  underline: {
    tag: 'u',
    content: true,
  },
  code: {
    tag: 'code',
    content: true,
  },
  superscript: {
    tag: 'sup',
    content: true,
  },
  subscript: {
    tag: 'sub',
    content: true,
  },
  highlight: {
    tag: 'mark',
    content: true,
  },
  textStyle: {
    tag: 'span',
    content: true,
  },
  anchor: {
    tag: 'span',
    content: true,
  },
  styled: {
    tag: 'span',
    content: true,
  },
} as const;
