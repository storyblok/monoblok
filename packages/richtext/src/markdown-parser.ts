import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Code, Heading, InlineCode, List, Image as MdastImage, Root, RootContent, Text } from 'mdast';
import type { StoryblokRichTextDocumentNode } from './types';

/**
 * Type for a Markdown AST node resolver.
 */
export type MarkdownNodeResolver = (
  node: RootContent,
  children: StoryblokRichTextDocumentNode[] | undefined
) => StoryblokRichTextDocumentNode | null;

/**
 * Options for the markdown parser, allowing custom resolvers.
 */
export interface MarkdownParserOptions {
  resolvers?: Partial<Record<string, MarkdownNodeResolver>>;
}

/**
 * Supported Markdown AST node types as constants for maintainability and type safety.
 * @see https://github.com/syntax-tree/mdast#nodes
 */
export const MarkdownAstNodeTypes = {
  HEADING: 'heading',
  PARAGRAPH: 'paragraph',
  TEXT: 'text',
  STRONG: 'strong',
  EMPHASIS: 'emphasis',
  LIST: 'list',
  LISTITEM: 'listItem',
  IMAGE: 'image',
  TABLE: 'table',
  TABLEROW: 'tableRow',
  TABLECELL: 'tableCell',
  BLOCKQUOTE: 'blockquote',
  INLINECODE: 'inlineCode',
  CODE: 'code',
  LINK: 'link',
  THEMATICBREAK: 'thematicBreak',
  DELETE: 'delete',
  BREAK: 'break',
} as const;

// Only allow supported node type string literals
export type MarkdownAstNodeType =
  | 'heading'
  | 'paragraph'
  | 'text'
  | 'strong'
  | 'emphasis'
  | 'list'
  | 'listItem'
  | 'image'
  | 'table'
  | 'tableRow'
  | 'tableCell'
  | 'blockquote'
  | 'inlineCode'
  | 'code'
  | 'link'
  | 'thematicBreak'
  | 'delete'
  | 'break';

/**
 * Default resolvers for supported Markdown AST node types.
 */
const defaultResolvers: Record<MarkdownAstNodeType, MarkdownNodeResolver> = {
  [MarkdownAstNodeTypes.HEADING]: (node, children) => {
    const heading = node as Heading;
    return {
      type: 'heading',
      attrs: { level: heading.depth },
      content: children,
    };
  },
  [MarkdownAstNodeTypes.PARAGRAPH]: (_node, children) => {
    return {
      type: 'paragraph',
      content: children,
    };
  },
  [MarkdownAstNodeTypes.TEXT]: (node) => {
    const textNode = node as Text;
    return {
      type: 'text',
      text: textNode.value,
    };
  },
  [MarkdownAstNodeTypes.STRONG]: (_node, children) => {
    // Bold mark
    const text = children?.map(c => c.text).join('') ?? '';
    return {
      type: 'text',
      text,
      marks: [{ type: 'bold' }],
    };
  },
  [MarkdownAstNodeTypes.EMPHASIS]: (_node, children) => {
    // Italic mark
    const text = children?.map(c => c.text).join('') ?? '';
    return {
      type: 'text',
      text,
      marks: [{ type: 'italic' }],
    };
  },
  [MarkdownAstNodeTypes.LIST]: (node, children) => {
    // node.ordered is true for ordered lists, false for bullet lists
    const type = (node as List).ordered ? 'ordered_list' : 'bullet_list';
    return {
      type,
      content: children,
    };
  },
  [MarkdownAstNodeTypes.LISTITEM]: (_node, children) => {
    return {
      type: 'list_item',
      content: children,
    };
  },
  [MarkdownAstNodeTypes.IMAGE]: (node) => {
    const image = node as MdastImage;
    return {
      type: 'image',
      attrs: {
        src: image.url,
        alt: image.alt || '',
        title: image.title || '',
      },
    };
  },
  [MarkdownAstNodeTypes.TABLE]: (_node, children) => {
    return {
      type: 'table',
      content: children,
    };
  },
  [MarkdownAstNodeTypes.TABLEROW]: (_node, children) => {
    return {
      type: 'tableRow',
      content: children,
    };
  },
  [MarkdownAstNodeTypes.TABLECELL]: (_node, children) => {
    return {
      type: 'tableCell',
      content: children,
      attrs: {
        colspan: 1,
        rowspan: 1,
        colwidth: null,
      },
    };
  },
  [MarkdownAstNodeTypes.BLOCKQUOTE]: (_node, children) => {
    // Blockquote resolver: maps markdown blockquotes to Storyblok blockquote nodes
    return {
      type: 'blockquote',
      content: children,
    };
  },
  [MarkdownAstNodeTypes.INLINECODE]: (node) => {
    // Inline code resolver: maps markdown inline code to Storyblok text node with code mark
    // Cast node to Mdast InlineCode type for type safety
    const inlineCodeNode = node as InlineCode;
    return {
      type: 'text',
      text: inlineCodeNode.value,
      marks: [{ type: 'code' }],
    };
  },
  [MarkdownAstNodeTypes.CODE]: (node) => {
    // Code block resolver: maps markdown code blocks to Storyblok code_block node
    // Cast node to Mdast Code type for type safety
    const codeNode = node as Code;
    return {
      type: 'code_block',
      attrs: {
        language: codeNode.lang || null,
      },
      content: [
        {
          type: 'text',
          text: codeNode.value,
        },
      ],
    };
  },
  [MarkdownAstNodeTypes.LINK]: (node, children) => {
    // Link resolver: maps markdown links to Storyblok link nodes
    // Cast node to Mdast Link type for type safety
    const linkNode = node as import('mdast').Link;
    return {
      type: 'link',
      attrs: {
        href: linkNode.url,
        title: linkNode.title || null,
      },
      content: children,
    };
  },
  [MarkdownAstNodeTypes.THEMATICBREAK]: () => {
    // Horizontal rule resolver: maps markdown thematic breaks to Storyblok horizontal_rule nodes
    return {
      type: 'horizontal_rule',
    };
  },
  [MarkdownAstNodeTypes.DELETE]: (_node, children) => {
    // Strikethrough resolver: maps markdown strikethrough to Storyblok text node with strike mark
    const text = children?.map(c => c.text).join('') ?? '';
    return {
      type: 'text',
      text,
      marks: [{ type: 'strike' }],
    };
  },
  [MarkdownAstNodeTypes.BREAK]: () => {
    // Break resolver: maps markdown hard line breaks to Storyblok hard_break nodes
    return {
      type: 'hard_break',
    };
  },
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
  // Parse markdown to MDAST (Markdown AST) with GFM support
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root;
  const resolvers = { ...defaultResolvers, ...options.resolvers };

  // Recursively convert MDAST nodes to Storyblok Richtext nodes using resolvers
  function convertNode(node: RootContent): StoryblokRichTextDocumentNode | null {
    // Gather children first (if any)
    let children: StoryblokRichTextDocumentNode[] | undefined;
    if ('children' in node && Array.isArray((node as any).children)) {
      children = ((node as any).children as RootContent[])
        .map(convertNode)
        .filter(Boolean) as StoryblokRichTextDocumentNode[];
    }
    // Only resolve supported node types
    if (Object.values(MarkdownAstNodeTypes).includes(node.type as MarkdownAstNodeType)) {
      const resolver = resolvers[node.type as MarkdownAstNodeType];
      if (resolver) {
        return resolver(node, children);
      }
    }
    // Not yet supported node type
    return null;
  }

  // Convert all top-level nodes
  const content = tree.children
    .map(convertNode)
    .filter(Boolean) as StoryblokRichTextDocumentNode[];

  // Return as Storyblok document node
  return {
    type: 'doc',
    content,
  };
}

// Export the MDAST types for use in resolvers
export {
  type Code as MdastCode,
  type Heading as MdastHeading,
  type InlineCode as MdastInlineCode,
  type List as MdastList,
  type MdastImage,
  type Root as MdastRoot,
  type RootContent as MdastRootContent,
  type Text as MdastText,
};
