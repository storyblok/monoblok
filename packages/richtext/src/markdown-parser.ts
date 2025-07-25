import MarkdownIt from 'markdown-it';
import { BlockTypes, MarkTypes, type StoryblokRichTextDocumentNode, TextTypes } from './types';

/**
 * markdown-it Token interface definition
 */
export interface MarkdownToken {
  type: string;
  tag: string;
  attrs: Array<[string, string]> | null;
  map: [number, number] | null;
  nesting: 1 | 0 | -1;
  level: number;
  children: MarkdownToken[] | null;
  content: string;
  markup: string;
  info: string;
  meta: any;
  block: boolean;
  hidden: boolean;
  attrGet: (name: string) => string | null;
  attrSet: (name: string, value: string) => void;
  attrPush: (attrData: [string, string]) => void;
  attrJoin: (name: string, value: string) => void;
  attrIndex: (name: string) => number;
}

/**
 * Type for a Markdown element resolver.
 */
export type MarkdownNodeResolver = (
  token: MarkdownToken,
  children: StoryblokRichTextDocumentNode[] | undefined
) => StoryblokRichTextDocumentNode | null;

/**
 * Options for the markdown parser, allowing custom resolvers.
 */
export interface MarkdownParserOptions {
  resolvers?: Partial<Record<string, MarkdownNodeResolver>>;
}

/**
 * Supported Markdown token types as constants for maintainability and type safety.
 * @see https://markdown-it.github.io/token-class.html
 */
export const MarkdownTokenTypes = {
  HEADING: 'heading_open',
  PARAGRAPH: 'paragraph_open',
  TEXT: 'text',
  STRONG: 'strong_open',
  EMP: 'em_open',
  ORDERED_LIST: 'ordered_list_open',
  BULLET_LIST: 'bullet_list_open',
  LIST_ITEM: 'list_item_open',
  IMAGE: 'image',
  BLOCKQUOTE: 'blockquote_open',
  CODE_INLINE: 'code_inline',
  CODE_BLOCK: 'code_block',
  FENCE: 'fence',
  LINK: 'link_open',
  HR: 'hr',
  DEL: 'del_open',
  HARD_BREAK: 'hardbreak',
  SOFT_BREAK: 'softbreak',
  TABLE: 'table_open',
  THEAD: 'thead_open',
  TBODY: 'tbody_open',
  TR: 'tr_open',
  TH: 'th_open',
  TD: 'td_open',
  S: 's_open',
} as const;

export type MarkdownTokenType = keyof typeof MarkdownTokenTypes;

/**
 * Default resolvers for supported Markdown token types.
 * These map markdown-it tokens to Storyblok RichText nodes.
 */
const defaultResolvers: Record<string, MarkdownNodeResolver> = {
  [MarkdownTokenTypes.HEADING]: (token, children) => {
    // Heading level is in token.tag (e.g., 'h1', 'h2', ...)
    const level = Number(token.tag.replace('h', ''));
    return {
      type: BlockTypes.HEADING,
      attrs: { level },
      content: children,
    };
  },
  [MarkdownTokenTypes.PARAGRAPH]: (_token, children) => {
    return {
      type: BlockTypes.PARAGRAPH,
      content: children,
    };
  },
  [MarkdownTokenTypes.TEXT]: (token) => {
    // Skip empty text nodes
    if (!token.content || token.content.trim() === '') {
      return null;
    }
    return {
      type: TextTypes.TEXT,
      text: token.content,
    };
  },
  [MarkdownTokenTypes.STRONG]: (_token, children) => {
    const text = children?.map(c => c.text).join('') ?? '';
    return {
      type: TextTypes.TEXT,
      text,
      marks: [{ type: MarkTypes.BOLD }],
    };
  },
  [MarkdownTokenTypes.EMP]: (_token, children) => {
    const text = children?.map(c => c.text).join('') ?? '';
    return {
      type: TextTypes.TEXT,
      text,
      marks: [{ type: MarkTypes.ITALIC }],
    };
  },
  [MarkdownTokenTypes.ORDERED_LIST]: (_token, children) => {
    return {
      type: BlockTypes.OL_LIST,
      content: children,
    };
  },
  [MarkdownTokenTypes.BULLET_LIST]: (_token, children) => {
    return {
      type: BlockTypes.UL_LIST,
      content: children,
    };
  },
  [MarkdownTokenTypes.LIST_ITEM]: (_token, children) => {
    return {
      type: BlockTypes.LIST_ITEM,
      content: children,
    };
  },
  [MarkdownTokenTypes.IMAGE]: (token) => {
    return {
      type: BlockTypes.IMAGE,
      attrs: {
        src: token.attrGet('src'),
        alt: token.content || token.attrGet('alt') || '',
        title: token.attrGet('title') || '',
      },
    };
  },
  [MarkdownTokenTypes.BLOCKQUOTE]: (_token, children) => {
    return {
      type: BlockTypes.QUOTE,
      content: children,
    };
  },
  [MarkdownTokenTypes.CODE_INLINE]: (token) => {
    return {
      type: MarkTypes.CODE,
      text: token.content,
      marks: [{ type: MarkTypes.CODE }],
    };
  },
  [MarkdownTokenTypes.CODE_BLOCK]: (token) => {
    return {
      type: BlockTypes.CODE_BLOCK,
      attrs: {
        language: null,
      },
      content: [
        {
          type: 'text',
          text: token.content,
        },
      ],
    };
  },
  [MarkdownTokenTypes.FENCE]: (token) => {
    // The 'fence' token is emitted by markdown-it for triple backtick code blocks (```),
    // which is the most common code block syntax in markdown. This ensures both indented
    // and fenced code blocks are supported.
    return {
      type: BlockTypes.CODE_BLOCK,
      attrs: {
        language: token.info || null, // language after ``` if present
      },
      content: [
        {
          type: 'text',
          text: token.content,
        },
      ],
    };
  },
  [MarkdownTokenTypes.LINK]: (token, children) => {
    return {
      type: MarkTypes.LINK,
      attrs: {
        href: token.attrGet('href'),
        title: token.attrGet('title') || null,
      },
      content: children,
    };
  },
  [MarkdownTokenTypes.HR]: () => {
    return {
      type: BlockTypes.HR,
    };
  },
  [MarkdownTokenTypes.DEL]: (_token, children) => {
    const text = children?.map(c => c.text).join('') ?? '';
    return {
      type: TextTypes.TEXT,
      text,
      marks: [{ type: MarkTypes.STRIKE }],
    };
  },
  [MarkdownTokenTypes.HARD_BREAK]: () => {
    return {
      type: BlockTypes.BR,
    };
  },
  [MarkdownTokenTypes.SOFT_BREAK]: () => {
    // Soft breaks are usually rendered as spaces in HTML, but you may want to handle them differently
    return {
      type: TextTypes.TEXT,
      text: ' ',
    };
  },
  // Table support (GFM tables are enabled by default in markdown-it)
  [MarkdownTokenTypes.TABLE]: (_token, children) => ({ type: BlockTypes.TABLE, content: children }),
  [MarkdownTokenTypes.THEAD]: () => null,
  [MarkdownTokenTypes.TBODY]: () => null,
  [MarkdownTokenTypes.TR]: (_token, children) => ({ type: BlockTypes.TABLE_ROW, content: children }),
  [MarkdownTokenTypes.TH]: (_token, children) => ({
    type: BlockTypes.TABLE_CELL,
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [
      {
        type: BlockTypes.PARAGRAPH,
        content: children || [],
      },
    ],
  }),
  [MarkdownTokenTypes.TD]: (_token, children) => ({
    type: BlockTypes.TABLE_CELL,
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [
      {
        type: BlockTypes.PARAGRAPH,
        content: children || [],
      },
    ],
  }),
  // Strikethrough support (GFM strikethrough is enabled by default in markdown-it)
  [MarkdownTokenTypes.S]: (_token, children) => ({
    type: TextTypes.TEXT,
    text: children?.map(c => c.text).join('') ?? '',
    marks: [{ type: MarkTypes.STRIKE }],
  }),
};

/**
 * Converts Markdown string to Storyblok Richtext Document Node using resolvers.
 * @param markdown - The markdown string to convert
 * @param options - Optional custom resolvers
 * @returns StoryblokRichTextDocumentNode
 */
export function markdownToStoryblokRichtext(
  markdown: string,
  options: MarkdownParserOptions = {},
): StoryblokRichTextDocumentNode {
  // Parse markdown to tokens using markdown-it with GFM support and hard breaks
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: true });
  const tokens = md.parse(markdown, {});
  const resolvers = { ...defaultResolvers, ...options.resolvers };

  // Helper to walk tokens and build a tree
  function walkTokens(tokens: MarkdownToken[], start = 0): [StoryblokRichTextDocumentNode[], number] {
    const nodes: StoryblokRichTextDocumentNode[] = [];
    let i = start;
    while (i < tokens.length) {
      const token = tokens[i];

      // Handle inline tokens (which contain actual text and marks)
      if (token.type === 'inline' && token.children) {
        const [inlineNodes] = walkTokens(token.children, 0);
        nodes.push(...inlineNodes);
        i++;
        continue;
      }

      if (token.nesting === 1) { // opening tag
        const type = token.type;
        const children: StoryblokRichTextDocumentNode[] = [];
        i++;
        while (i < tokens.length && !(tokens[i].type === type.replace('_open', '_close') && tokens[i].nesting === -1)) {
          const [childNodes, consumed] = walkTokens(tokens, i);
          children.push(...childNodes);
          i += consumed;
        }
        const resolver = resolvers[type];
        if (resolver) {
          const node = resolver(token, children.length ? children : undefined);
          if (node) {
            nodes.push(node);
          }
          else {
            // If resolver returns null, flatten children into parent
            nodes.push(...children);
          }
        }
        i++; // skip closing tag
      }
      else if (token.nesting === 0) { // self-closing or text
        const resolver = resolvers[token.type];
        if (resolver) {
          const node = resolver(token, undefined);
          if (node) {
            nodes.push(node);
          }
        }
        i++;
      }
      else if (token.nesting === -1) { // closing tag, return to parent
        break;
      }
      else {
        i++;
      }
    }
    return [nodes, i - start];
  }

  // Convert all tokens to Storyblok nodes
  const [content] = walkTokens(tokens);

  // Return as Storyblok document node
  return {
    type: 'doc',
    content,
  };
}
