import { escapeHtml } from './utils';
import { optimizeImage } from './images-optimization';
import { areLinkMarksEqual, attrsToHtmlString, getStaticChildren, getTextNodeLinkMark, isSelfClosing, isTableHeaderRow, normalizeNodes, processAttrs, resolveTag, styleToString } from './static';
import type { RenderSpec, SbRichTextElement, SbRichTextInput, SbRichTextMark, SbRichTextNode, SbRichTextRenderContext, SbRichTextTextNode } from './static';
/**
 * Renders a Storyblok RichText JSON document to an HTML string.
 *
 * @param document - RichText JSON document, array of nodes, or nullish value
 * @param context - Renderer configuration with custom node/mark renderers
 * @returns Rendered HTML string
 *
 * @example
 * ```ts
 * const html = renderRichText({
 *   type: 'doc',
 *   content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }]
 * });
 * // => '<p>Hello</p>'
 * ```
 */
export function renderRichText(
  document: SbRichTextInput,
  context?: SbRichTextRenderContext,
): string {
  const nodes = normalizeNodes(document);
  return nodes?.length ? renderChildren(nodes, context) : '';
}
type NodeRenderer = (props: SbRichTextNode & { children: string; context?: SbRichTextRenderContext }) => string;
type MarkRenderer = (props: SbRichTextMark & { children: string; context?: SbRichTextRenderContext }) => string;

/** Renders a single node to HTML. */
function renderNode(node: SbRichTextNode, context?: SbRichTextRenderContext): string {
  const content = node.type !== 'text' && node.content ? renderChildren(node.content, context) : '';

  // Custom renderer takes full control
  const customRenderer = context?.renderers?.[node.type] as NodeRenderer | undefined;
  if (customRenderer) {
    // When passing context to a custom renderer, exclude that renderer type
    // to prevent infinite loops if the custom renderer calls renderRichText internally
    const contextForCustom = context?.renderers?.[node.type]
      ? { ...context, renderers: { ...context.renderers, [node.type]: undefined } }
      : context;
    return customRenderer({ ...node, children: content, context: contextForCustom });
  }

  if (node.type === 'text') {
    return renderTextNode(node, node.marks, context);
  }

  if (node.type === 'blok') {
    console.warn(
      '"blok" nodes require a custom renderer in renderRichText.',
    );
    return '';
  }

  const tag = resolveTag(node);

  // No tag (e.g., nested doc): render children directly
  if (!tag) {
    return content;
  }

  if (node.type === 'image' && context?.optimizeImage) {
    return renderOptimizedImage(node, context);
  }

  const htmlAttrs = buildHtmlAttrs(node.type, node.attrs);

  if (isSelfClosing(tag)) {
    return `<${tag}${htmlAttrs}>`;
  }

  if (node.type === 'table') {
    return `<${tag}${htmlAttrs}>${renderTableRows(node.content, context)}</${tag}>`;
  }

  const staticChildren = getStaticChildren(node);
  if (staticChildren) {
    const inner = renderStaticStructure(node.type, staticChildren, node.attrs, content);
    return `<${tag}>${inner}</${tag}>`;
  }

  return `<${tag}${htmlAttrs}>${content}</${tag}>`;
}

/** Renders an image node with optimization applied. */
function renderOptimizedImage(
  node: SbRichTextNode,
  context: SbRichTextRenderContext,
): string {
  const attrs = node.attrs as Record<string, unknown> | undefined;
  const src = attrs?.src as string | undefined;

  let finalAttrs: Record<string, unknown> | undefined = attrs;

  if (src) {
    const { src: optimizedSrc, attrs: extraAttrs } = optimizeImage(
      src,
      context.optimizeImage,
    );

    finalAttrs = {
      ...attrs,
      src: optimizedSrc,
      ...extraAttrs,
    };
  }

  const htmlAttrs = buildHtmlAttrs('image', finalAttrs);
  return htmlAttrs ? `<img${htmlAttrs}>` : '<img>';
}

/**
 * Renders child nodes, merging adjacent text nodes that share the same link mark.
 * This produces cleaner HTML: `<a href="...">text <b>bold</b> more</a>`
 * instead of: `<a>text</a><a><b>bold</b></a><a>more</a>`
 */
function renderChildren(children: SbRichTextNode[], context?: SbRichTextRenderContext): string {
  let result = '';
  let i = 0;
  const len = children.length;

  while (i < len) {
    const node = children[i];
    const linkMark = getTextNodeLinkMark(node);

    if (linkMark) {
      // Find end of link group (consecutive text nodes with same link)
      let end = i + 1;
      while (end < len && areLinkMarksEqual(linkMark, getTextNodeLinkMark(children[end]))) {
        end++;
      }
      result += renderLinkGroup(children, i, end, linkMark, context);
      i = end;
    }
    else {
      result += renderNode(node, context);
      i++;
    }
  }

  return result;
}

/** Renders a text node with its marks. */
function renderTextNode(
  node: SbRichTextTextNode,
  marks: SbRichTextMark[] | undefined,
  context?: SbRichTextRenderContext,
): string {
  let html = escapeHtml(node.text);

  if (!marks?.length) {
    return html;
  }

  for (const mark of marks) {
    html = wrapWithMark(html, mark, context);
  }

  return html;
}

/** Wraps content with a single mark tag. */
function wrapWithMark(
  content: string,
  mark: SbRichTextMark,
  context?: SbRichTextRenderContext,
): string {
  // Custom mark renderer
  const customRenderer = context?.renderers?.[mark.type] as MarkRenderer | undefined;
  if (customRenderer) {
    return customRenderer({
      ...mark,
      children: content,
      context,
    });
  }

  const tag = resolveTag(mark);
  if (!tag) {
    return content;
  }

  const htmlAttrs = buildHtmlAttrs(mark.type, mark.attrs);
  return `<${tag}${htmlAttrs}>${content}</${tag}>`;
}

/** Link Mark Merging */

/** Renders consecutive text nodes (from start to end) under a single link tag. */
function renderLinkGroup(
  children: SbRichTextNode[],
  start: number,
  end: number,
  linkMark: SbRichTextMark,
  context?: SbRichTextRenderContext,
): string {
  let inner = '';
  for (let i = start; i < end; i++) {
    const node = children[i] as SbRichTextTextNode;
    const innerMarks = node.marks?.filter(m => m.type !== 'link');
    inner += renderTextNode(node, innerMarks, context);
  }

  // Custom link renderer
  const customRenderer = context?.renderers?.[linkMark.type] as MarkRenderer | undefined;
  if (customRenderer) {
    return customRenderer({
      ...linkMark,
      children: inner,
      context,
    });
  }

  const tag = resolveTag(linkMark);
  if (!tag) {
    return inner;
  }

  const htmlAttrs = buildHtmlAttrs(linkMark.type, linkMark.attrs);
  return `<${tag}${htmlAttrs}>${inner}</${tag}>`;
}

/** Table Rendering */

/** Renders table rows with thead/tbody grouping based on cell types. */
function renderTableRows(
  rows: SbRichTextNode[] | undefined,
  context?: SbRichTextRenderContext,
): string {
  if (!rows?.length) {
    return '';
  }

  // Find where header rows end (contiguous tableHeader rows at start)
  let headerEnd = 0;
  while (headerEnd < rows.length && isTableHeaderRow(rows[headerEnd])) {
    headerEnd++;
  }

  let result = '';

  if (headerEnd > 0) {
    result += '<thead>';
    for (let i = 0; i < headerEnd; i++) {
      result += renderNode(rows[i], context);
    }
    result += '</thead>';
  }

  if (headerEnd < rows.length) {
    result += '<tbody>';
    for (let i = headerEnd; i < rows.length; i++) {
      result += renderNode(rows[i], context);
    }
    result += '</tbody>';
  }

  return result;
}

// Static Children (e.g., pre > code)

/** Renders nested static structure defined in render map. */
function renderStaticStructure(
  type: SbRichTextElement,
  specs: readonly RenderSpec[],
  parentAttrs: Record<string, unknown> | undefined,
  content: string,
): string {
  let result = '';

  for (const spec of specs) {
    const { tag, children, attrs: specAttrs } = spec;
    const mergedAttrs = { ...specAttrs, ...parentAttrs };
    const htmlAttrs = buildHtmlAttrs(type, mergedAttrs);

    if (isSelfClosing(tag)) {
      result += `<${tag}${htmlAttrs}>`;
    }
    else {
      const inner = children
        ? renderStaticStructure(type, children, parentAttrs, content)
        : content;
      result += `<${tag}${htmlAttrs}>${inner}</${tag}>`;
    }
  }

  return result;
}

/** Builds HTML attribute string from node/mark type and attrs. */
export function buildHtmlAttrs(type: SbRichTextElement, attrs: Record<string, unknown> | undefined): string {
  const processed = processAttrs(type, attrs, {
    colspan: 'colspan',
    rowspan: 'rowspan',
  });

  const styleObj = processed.style as Record<string, unknown> | undefined;
  const finalAttrs: Record<string, unknown> = { ...processed };

  if (styleObj) {
    finalAttrs.style = styleToString(styleObj);
  }

  return attrsToHtmlString(finalAttrs);
}
