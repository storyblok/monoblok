import {
  BlockTypes,
  type MarkNode,
  MarkTypes,
  type StoryblokRichTextDocumentNode,
  TextTypes,
} from './types';
import {
  type HTMLElement as NodeHTMLParserNodeElement,
  type TextNode as NodeHTMLParserNodeText,
  NodeType,
  parse,
  valid,
} from 'node-html-parser';
import { BLOCK_LEVEL_TAGS, SELF_CLOSING_TAGS } from './utils';

export interface StyleOption {
  name: string;
  value: string;
}

export type RichTextAttrs = Record<string, string | number | boolean | null>;

export type HTMLAttrs = Record<string, string>;

export interface HTMLParserOptions {
  allowCustomAttributes?: boolean;
  normalizeWhitespace?: boolean;
  resolvers?: Record<string, HTMLNodeElementResolver>;
  styleOptions?: StyleOption[];
}

export interface HTMLNodeElement {
  attrs: HTMLAttrs;
  children?: (HTMLNodeElement | HTMLNodeText)[];
  parent: HTMLNodeElement | null;
  tag: keyof HTMLElementTagNameMap;
  text: string;
  type: 'element';
}

export interface HTMLNodeText {
  isLayoutWhitespace: boolean;
  isWhitespace: boolean;
  parent: HTMLNodeElement | null;
  text: string;
  type: 'text';
}

export interface HTMLNodeElementResolverOptions {
  allowCustomAttributes?: boolean;
  styleOptions?: StyleOption[];
}

export type HTMLNodeElementResolver = (
  node: HTMLNodeElement,
  content: StoryblokRichTextDocumentNode[] | undefined,
  options: HTMLNodeElementResolverOptions
) => StoryblokRichTextDocumentNode | StoryblokRichTextDocumentNode[] | null;

export const HTMLTags = {
  H1: 'h1',
  H2: 'h2',
  H3: 'h3',
  H4: 'h4',
  H5: 'h5',
  H6: 'h6',
  P: 'p',
  OL: 'ol',
  UL: 'ul',
  LI: 'li',
  TABLE: 'table',
  THEAD: 'thead',
  TBODY: 'tbody',
  TR: 'tr',
  TH: 'th',
  TD: 'td',
  BLOCKQUOTE: 'blockquote',
  PRE: 'pre',
  SPAN: 'span',
  STRONG: 'strong',
  B: 'b',
  EM: 'em',
  I: 'i',
  A: 'a',
  DEL: 'del',
  S: 's',
  CODE: 'code',
  IMG: 'img',
  HR: 'hr',
  BR: 'br',
};

const tagMap = {
  [HTMLTags.H1]: BlockTypes.HEADING,
  [HTMLTags.H2]: BlockTypes.HEADING,
  [HTMLTags.H3]: BlockTypes.HEADING,
  [HTMLTags.H4]: BlockTypes.HEADING,
  [HTMLTags.H5]: BlockTypes.HEADING,
  [HTMLTags.H6]: BlockTypes.HEADING,
  [HTMLTags.P]: BlockTypes.PARAGRAPH,
  [HTMLTags.OL]: BlockTypes.OL_LIST,
  [HTMLTags.UL]: BlockTypes.UL_LIST,
  [HTMLTags.LI]: BlockTypes.LIST_ITEM,
  [HTMLTags.BLOCKQUOTE]: BlockTypes.QUOTE,
  [HTMLTags.PRE]: BlockTypes.CODE_BLOCK,
  [HTMLTags.TABLE]: BlockTypes.TABLE,
  [HTMLTags.THEAD]: BlockTypes.TABLE_HEADER,
  [HTMLTags.TR]: BlockTypes.TABLE_ROW,
  [HTMLTags.TH]: BlockTypes.TABLE_CELL,
  [HTMLTags.TD]: BlockTypes.TABLE_CELL,
  [HTMLTags.IMG]: BlockTypes.IMAGE,
  [HTMLTags.HR]: BlockTypes.HR,
  [HTMLTags.BR]: BlockTypes.BR,
} as const;

function createMark(markNodePartial: Partial<MarkNode> & { type: MarkNode['type'] }): MarkNode {
  return {
    ...markNodePartial,
    content: [],
  };
}

function resolveBlock({
  attrs,
  marks,
}: {
  attrs?: RichTextAttrs;
  marks?: MarkNode[];
} = {}): HTMLNodeElementResolver {
  return (node, content) => {
    const unsupportedAttributes = Object.keys(node.attrs).filter(attr => !attrs?.[attr]);
    for (const attr of unsupportedAttributes) {
      console.warn(`[StoryblokRichText] - \`${attr}\` "${node.attrs[attr]}" on \`<${node.tag}>\` can not be transformed to rich text.`);
    }

    return {
      type: tagMap[node.tag],
      content,
      attrs,
      marks,
    };
  };
}

function resolveBlockWithParagraphWrappers({
  attrs,
  marks,
}: {
  attrs?: RichTextAttrs;
  marks?: MarkNode[];
} = {}): HTMLNodeElementResolver {
  return (node, content = [], options) => {
    const contentProcessed: StoryblokRichTextDocumentNode[] = [];
    let newParagraph: StoryblokRichTextDocumentNode | null = null;

    for (const child of content) {
      // 1. Wrap text nodes in a paragraph
      if (child.type === TextTypes.TEXT) {
        if (!newParagraph) {
          newParagraph = { type: BlockTypes.PARAGRAPH, content: [] };
        }
        newParagraph.content?.push(child);
      }

      if (child.type !== TextTypes.TEXT) {
        // 2. If a text node is followed by a non-text node, push the paragraph
        if (newParagraph) {
          contentProcessed.push(newParagraph);
          newParagraph = null;
        }
        contentProcessed.push(child);
      }
    }

    // 3. If there's a pending paragraph, push it
    if (newParagraph) {
      contentProcessed.push(newParagraph);
    }

    return resolveBlock({ attrs, marks })(node, contentProcessed, options);
  };
}

function resolveText({
  marks: extraMarks = [],
}: {
  marks?: MarkNode[];
} = {}): HTMLNodeElementResolver {
  return (node, _, { styleOptions }) => {
    const marks: MarkNode[] = [...extraMarks];
    const nodeStyles = node.attrs.class ? node.attrs.class.split(' ') : [];
    const allowedStyles = styleOptions?.map(opt => opt.value) ?? [];
    const styles = allowedStyles.filter(x => nodeStyles.includes(x));
    if (styles.length > 0) {
      marks.push(createMark({
        type: MarkTypes.STYLED,
        attrs: {
          class: styles.join(' '),
        },
      }));
    }
    const removedStyles = nodeStyles.filter(x => !allowedStyles.includes(x));
    for (const removedStyle of removedStyles) {
      console.warn(`[StoryblokRichText] - \`class\` "${removedStyle}" on \`<${node.tag}>\` can not be transformed to rich text.`);
    }

    return {
      type: TextTypes.TEXT,
      text: node.text,
      marks: marks.length > 0 ? marks : undefined,
    };
  };
}

function resolveCode(): HTMLNodeElementResolver {
  return (node, content, options) => {
    // We treat <code> tags separately if they're in <pre> tags
    if (node.parent?.tag === HTMLTags.PRE) {
      return null;
    }

    return resolveText({ marks: [createMark({ type: MarkTypes.CODE })] })(node, content, options);
  };
}

function resolveHeading(): HTMLNodeElementResolver {
  return (node, content, options) => {
    const levelMatch = node.tag.match(/h(\d)/);
    if (!levelMatch) {
      throw new Error('Invalid heading tag!');
    }

    const level = Number(levelMatch[1]);
    return resolveBlock({
      attrs: { level },
    })(node, content, options);
  };
}

function resolveTableCell(): HTMLNodeElementResolver {
  return (node, content, options) => {
    const attrs = {
      colspan: node.attrs.colspan ?? 1,
      rowspan: node.attrs.rowspan ?? 1,
      colwidth: node.attrs.colwidth ?? null,
    };

    return resolveBlockWithParagraphWrappers({ attrs })(node, content, options);
  };
}

function resolvePre(): HTMLNodeElementResolver {
  return (node, _, options) => {
    if (node.children && node.children.length > 1) {
      throw new Error('Multiple child nodes within `<pre>` are not allowed!');
    }

    const attrs: { language?: string } = {};
    const child = node.children?.[0];
    if (!child) {
      return resolveBlock({ attrs })(node, [], options);
    }

    const text = child.text;
    if (child.type === 'element' && child.tag === HTMLTags.CODE) {
      const languageMatch = child.attrs.class?.match(/(?:^|\s)language-([\w-]+)(?:\s|$)/);
      if (languageMatch) {
        attrs.language = languageMatch[1];
      }
    }
    const content = [{ type: TextTypes.TEXT, text }];

    return resolveBlock({ attrs })(node, content, options);
  };
}

function resolveAnchor(): HTMLNodeElementResolver {
  return (node, content, { allowCustomAttributes, styleOptions }) => {
    const {
      href,
      target,
      id,
      ...custom
    }: { href?: string; target?: string; id?: string } & Record<
      string,
      string
    > = node.attrs;
    const type = !href && id ? MarkTypes.ANCHOR : MarkTypes.LINK;
    const mark = createMark({
      type,
      attrs: {
        href,
        target,
        anchor: id,
        custom: allowCustomAttributes && Object.keys(custom).length > 0 ? custom : undefined,
      },
    });

    return resolveText({ marks: [mark] })(node, content, { allowCustomAttributes, styleOptions });
  };
}

function resolveImage(): HTMLNodeElementResolver {
  return (node, content, options) => {
    const {
      src,
      alt,
      title,
    }: { src?: string; alt?: string; title?: string } & Record<
      string,
      string
    > = node.attrs;
    const attrs = {
      src,
      alt,
      title,
    };

    return resolveBlock({ attrs })(node, content, options);
  };
}

function resolveContentOnly(): HTMLNodeElementResolver {
  return (_, content) => {
    return content || null;
  };
}

/**
 * Default resolvers for supported HTML tags.
 */
const defaultResolvers: Record<string, HTMLNodeElementResolver> = {
  // Block-level elements
  [HTMLTags.H1]: resolveHeading(),
  [HTMLTags.H2]: resolveHeading(),
  [HTMLTags.H3]: resolveHeading(),
  [HTMLTags.H4]: resolveHeading(),
  [HTMLTags.H5]: resolveHeading(),
  [HTMLTags.H6]: resolveHeading(),
  [HTMLTags.P]: resolveBlock(),
  [HTMLTags.OL]: resolveBlock(),
  [HTMLTags.UL]: resolveBlock(),
  [HTMLTags.LI]: resolveBlockWithParagraphWrappers(),
  [HTMLTags.BLOCKQUOTE]: resolveBlockWithParagraphWrappers(),
  [HTMLTags.PRE]: resolvePre(),
  [HTMLTags.TABLE]: resolveBlock(),
  [HTMLTags.THEAD]: resolveContentOnly(),
  [HTMLTags.TBODY]: resolveContentOnly(),
  [HTMLTags.TR]: resolveBlock(),
  [HTMLTags.TH]: resolveTableCell(),
  [HTMLTags.TD]: resolveTableCell(),

  // Inline elements
  [HTMLTags.SPAN]: resolveText(),
  [HTMLTags.STRONG]: resolveText({ marks: [createMark({ type: MarkTypes.BOLD })] }),
  [HTMLTags.B]: resolveText({ marks: [createMark({ type: MarkTypes.BOLD })] }),
  [HTMLTags.EM]: resolveText({ marks: [createMark({ type: MarkTypes.ITALIC })] }),
  [HTMLTags.I]: resolveText({ marks: [createMark({ type: MarkTypes.ITALIC })] }),
  [HTMLTags.A]: resolveAnchor(),
  [HTMLTags.DEL]: resolveText({ marks: [createMark({ type: MarkTypes.STRIKE })] }),
  [HTMLTags.S]: resolveText({ marks: [createMark({ type: MarkTypes.STRIKE })] }),
  [HTMLTags.CODE]: resolveCode(),

  // Self-closing tags
  [HTMLTags.IMG]: resolveImage(),
  [HTMLTags.HR]: resolveBlock(),
  [HTMLTags.BR]: resolveBlock(),
};

function textToRichTextNode(node: HTMLNodeText) {
  return {
    type: TextTypes.TEXT,
    text: node.text,
  } satisfies StoryblokRichTextDocumentNode;
}

function elementToRichTextNode(node: HTMLNodeElement, options: Required<HTMLParserOptions>) {
  const resolver = options.resolvers[node.tag];
  if (!resolver) {
    throw new Error(`No resolver specified for tag "${node.tag}"!`);
  }

  const children = (node.children || [])
    .map(n => toRichTextNode(n, options))
    .flat()
    .filter(c => c !== null);

  return resolver(node, children, options);
}

function removeWhitespaceFromNode(node: HTMLNodeElement | HTMLNodeText) {
  const nodeProcessed = { ...node };
  // Remove node if it is not affecting rendering
  const isUnnecessaryWhitespace = nodeProcessed.type === 'text' && nodeProcessed.isWhitespace && !nodeProcessed.isLayoutWhitespace;
  if (isUnnecessaryWhitespace) {
    return null;
  }

  // Replace newlines with spaces except within tags with preformatted text
  const hasFormattedText = 'tag' in nodeProcessed && ['pre', 'textarea', 'script', 'style'].includes(nodeProcessed.tag);
  if (!hasFormattedText) {
    nodeProcessed.text = nodeProcessed.text.replace(/(\r\n|\n|\r)/g, ' ');
  }

  return nodeProcessed;
}

/**
 * Converts a node to a Rich Text node.
 */
function toRichTextNode(
  node: HTMLNodeElement | HTMLNodeText,
  options: Required<HTMLParserOptions>,
): StoryblokRichTextDocumentNode | StoryblokRichTextDocumentNode[] | null {
  let nodeProcessed = { ...node };
  if (options.normalizeWhitespace) {
    const normalizedNode = removeWhitespaceFromNode(node);
    if (!normalizedNode) {
      return null;
    }

    nodeProcessed = normalizedNode;
  }

  if (nodeProcessed.type === 'text') {
    return textToRichTextNode(nodeProcessed);
  }

  return elementToRichTextNode(nodeProcessed, options);
}

function getPreviousElementSibling(node: NodeHTMLParserNodeText): NodeHTMLParserNodeElement | null {
  const index = node.parentNode.childNodes.indexOf(node);
  const previousSibling = node.parentNode.childNodes[index - 1];
  if (!previousSibling) {
    return null;
  }

  if (previousSibling.nodeType !== NodeType.ELEMENT_NODE) {
    return getPreviousElementSibling(previousSibling as NodeHTMLParserNodeText);
  }

  return previousSibling as NodeHTMLParserNodeElement;
}

function getNextElementSibling(node: NodeHTMLParserNodeText): NodeHTMLParserNodeElement | null {
  const index = node.parentNode.childNodes.indexOf(node);
  const nextSibling = node.parentNode.childNodes[index + 1];
  if (!nextSibling) {
    return null;
  }

  if (nextSibling.nodeType !== NodeType.ELEMENT_NODE) {
    return getNextElementSibling(nextSibling as NodeHTMLParserNodeText);
  }

  return nextSibling as NodeHTMLParserNodeElement;
}

const tagsNotRequiringWhitespace = [...BLOCK_LEVEL_TAGS, ...SELF_CLOSING_TAGS];
function tagRequiresWhitespace(tag: string) {
  return !tagsNotRequiringWhitespace.includes(tag.toLowerCase());
}

/**
 * Adapts a `node-html-parse` node to a custom parser node format.
 * We don't want to expose the `node-html-parse` types directly, so this
 * function adapts the nodes to our custom format.
 */
function adaptParserNode(node: NodeHTMLParserNodeElement, parent?: HTMLNodeElement | null): HTMLNodeElement;
function adaptParserNode(node: NodeHTMLParserNodeText, parent?: HTMLNodeElement | null): HTMLNodeText;
function adaptParserNode(node: NodeHTMLParserNodeElement | NodeHTMLParserNodeText, parent?: HTMLNodeElement | null): HTMLNodeElement | HTMLNodeText;
function adaptParserNode(
  node: NodeHTMLParserNodeElement | NodeHTMLParserNodeText,
  parent: HTMLNodeElement | null = null,
): HTMLNodeElement | HTMLNodeText {
  if ('trimmedRawText' in node) {
    const previousElementSibling = getPreviousElementSibling(node);
    const previousSiblingRequiresWhitespace = !previousElementSibling || tagRequiresWhitespace(previousElementSibling.tagName);
    const nextElementSibling = getNextElementSibling(node);
    const nextSiblingRequiresWhitespace = !nextElementSibling || tagRequiresWhitespace(nextElementSibling.tagName);
    const isLayoutWhitespace = node.isWhitespace && (previousSiblingRequiresWhitespace || nextSiblingRequiresWhitespace);

    return {
      type: 'text',
      text: node.text,
      parent,
      isWhitespace: node.isWhitespace,
      isLayoutWhitespace,
    } satisfies HTMLNodeText;
  }

  const elementNode: HTMLNodeElement = {
    type: 'element',
    tag: node.tagName.toLowerCase() as keyof HTMLElementTagNameMap,
    text: node.text,
    attrs: node.attributes,
    parent,
  };
  elementNode.children = node.childNodes.map(child =>
    adaptParserNode(child as NodeHTMLParserNodeElement | NodeHTMLParserNodeText, elementNode),
  );

  return elementNode;
}

export const defaultOptions: Required<HTMLParserOptions> = {
  allowCustomAttributes: false,
  normalizeWhitespace: true,
  resolvers: defaultResolvers,
  styleOptions: [],
} as const;

/**
 * Convert HTML to Storyblok Rich Text format.
 */
export function htmlToStoryblokRichtext(
  html: string,
  options: HTMLParserOptions = {},
): StoryblokRichTextDocumentNode {
  if (!valid(html)) {
    throw new Error('Invalid HTML: The provided string could not be parsed. Common causes include unclosed or mismatched tags!');
  }

  const root = parse(html, { blockTextElements: {} });
  const content = root.childNodes
    .map(parserNode =>
      toRichTextNode(adaptParserNode(parserNode as NodeHTMLParserNodeElement | NodeHTMLParserNodeText), {
        ...defaultOptions,
        ...options,
        resolvers: {
          ...defaultOptions.resolvers,
          ...options.resolvers,
        },
      }),
    )
    .flat()
    .filter(c => c !== null);

  return {
    type: 'doc',
    content,
  };
}
