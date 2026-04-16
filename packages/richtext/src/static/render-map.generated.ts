// THIS FILE IS AUTO-GENERATED. DO NOT EDIT.
import { resolveHeadingTag } from './dynamic-resolvers';
/**
  * Render config for Tiptap nodes
  */
  export const NODE_RENDER_MAP = {
  paragraph: {
  "tag": "p",
  "content": true
},
  doc: null,
  text: null,
  blockquote: {
  "tag": "blockquote",
  "content": true
},
  heading: {
      resolve: resolveHeadingTag,
      },
  bullet_list: {
  "tag": "ul",
  "content": true
},
  ordered_list: {
  "tag": "ol",
  "attrs": {
    "start": 1,
    "order": 1
  },
  "content": true
},
  list_item: {
  "tag": "li",
  "content": true
},
  code_block: {
  "tag": "pre",
  "children": [
    {
      "tag": "code",
      "content": true
    }
  ]
},
  hard_break: {
  "tag": "br"
},
  horizontal_rule: {
  "tag": "hr"
},
  image: {
  "tag": "img"
},
  emoji: {
  "tag": "span",
  "attrs": {
    "data-type": "emoji"
  },
  "children": [
    {
      "tag": "img",
      "attrs": {
        "style": "width: 1.25em; height: 1.25em; vertical-align: text-top",
        "draggable": "false",
        "loading": "lazy"
      }
    }
  ]
},
  table: {
  "tag": "table",
  "children": [
    {
      "tag": "tbody",
      "content": true
    }
  ]
},
  tableRow: {
  "tag": "tr",
  "content": true
},
  tableCell: {
  "tag": "td",
  "content": true
},
  tableHeader: {
  "tag": "th",
  "content": true
},
  blok: {
  "tag": "span",
  "attrs": {
    "style": "display: none"
  }
},
  details: {
  "tag": "details",
  "content": true
},
  detailsContent: {
  "tag": "div",
  "attrs": {
    "data-type": "detailsContent"
  },
  "content": true
},
  detailsSummary: {
  "tag": "summary",
  "content": true
},
} as const;

/**
  * Render config for Tiptap marks
  */
  export const MARK_RENDER_MAP = {
  link: {
  "tag": "a",
  "content": true
},
  bold: {
  "tag": "strong",
  "content": true
},
  italic: {
  "tag": "em",
  "content": true
},
  strike: {
  "tag": "s",
  "content": true
},
  underline: {
  "tag": "u",
  "content": true
},
  code: {
  "tag": "code",
  "content": true
},
  superscript: {
  "tag": "sup",
  "content": true
},
  subscript: {
  "tag": "sub",
  "content": true
},
  highlight: {
  "tag": "mark",
  "content": true
},
  textStyle: {
  "tag": "span",
  "content": true
},
  anchor: {
  "tag": "span",
  "content": true
},
  styled: {
  "tag": "span",
  "content": true
},
  reporter: null,
} as const;

