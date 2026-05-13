import { escapeHtml } from '../utils';
import { optimizeImage } from '../images-optimization';
import { escapeAttr, processAttrs } from './attribute';
import { areLinkMarksEqual, getTextNodeLinkMark, isTableHeaderRow } from './node-helpers';
import { styleToString } from './style';
import type { AttrValue, RenderSpec, SbRichTextDoc, SbRichTextElement, SbRichTextOptions, TextNode } from './types';
import type { PMMark } from './types.generated';
import { getStaticChildren, isSelfClosing, resolveTag } from './util';

/**
 * Renders a Storyblok RichText JSON document to an HTML string.
 *
 * @param document - RichText JSON document, array of nodes, or nullish value
 * @param options - Renderer configuration with custom node/mark renderers
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
  document: SbRichTextDoc | SbRichTextDoc[] | null | undefined,
  options?: SbRichTextOptions,
): string {
  if (!document) {
    return '';
  }

  if (Array.isArray(document)) {
    return renderChildren(document, options);
  }

  const nodes = document.type === 'doc' ? document.content : [document];
  return nodes?.length ? renderChildren(nodes, options) : '';
}

/** Renders a single node to HTML. */
function renderNode(node: SbRichTextDoc, options?: SbRichTextOptions): string {
  if (node.type === 'text') {
    return renderTextNode(node, node.marks, options);
  }

  // Custom renderer takes full control
  const customRenderer = options?.renderers?.[node.type as keyof typeof options.renderers];
  if (customRenderer) {
    return (customRenderer as (props: typeof node) => string)(node);
  }

  if (node.type === 'blok') {
    console.warn('Rendering of "blok" nodes is not supported in richTextRenderer.');
    return '';
  }

  const tag = resolveTag(node);

  // No tag (e.g., nested doc): render children directly
  if (!tag) {
    return node.content ? renderChildren(node.content, options) : '';
  }

  if (node.type === 'image' && options?.optimizeImages) {
    return renderOptimizedImage(node, options);
  }

  const htmlAttrs = buildHtmlAttrs(node.type, node.attrs);

  if (isSelfClosing(tag)) {
    return `<${tag}${htmlAttrs}>`;
  }

  if (node.type === 'table') {
    return `<${tag}${htmlAttrs}>${renderTableRows(node.content, options)}</${tag}>`;
  }

  const content = node.content ? renderChildren(node.content, options) : '';

  const staticChildren = getStaticChildren(node);
  if (staticChildren) {
    const inner = renderStaticStructure(node.type, staticChildren, node.attrs, content);
    return `<${tag}>${inner}</${tag}>`;
  }

  return `<${tag}${htmlAttrs}>${content}</${tag}>`;
}

/** Renders an image node with optimization applied. */
function renderOptimizedImage(
  node: SbRichTextDoc,
  options: SbRichTextOptions,
): string {
  const attrs = node.attrs as Record<string, unknown> | undefined;
  const src = attrs?.src as string | undefined;

  let finalAttrs: Record<string, unknown> | undefined = attrs;

  if (src) {
    const { src: optimizedSrc, attrs: extraAttrs } = optimizeImage(
      src,
      options.optimizeImages,
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
function renderChildren(children: SbRichTextDoc[], options?: SbRichTextOptions): string {
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
      result += renderLinkGroup(children, i, end, linkMark, options);
      i = end;
    }
    else {
      result += renderNode(node, options);
      i++;
    }
  }

  return result;
}

/** Renders a text node with its marks. */
function renderTextNode(
  node: TextNode,
  marks: PMMark[] | undefined,
  options?: SbRichTextOptions,
): string {
  let html = escapeHtml(node.text);

  if (!marks?.length) {
    return html;
  }

  for (const mark of marks) {
    html = wrapWithMark(html, mark, options);
  }

  return html;
}

/** Wraps content with a single mark tag. */
function wrapWithMark(
  content: string,
  mark: PMMark,
  options?: SbRichTextOptions,
): string {
  // Custom mark renderer
  const customRenderer = options?.renderers?.[mark.type as keyof typeof options.renderers];
  if (customRenderer) {
    return (customRenderer as (props: typeof mark & { children: string }) => string)({
      ...mark,
      children: content,
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
  children: SbRichTextDoc[],
  start: number,
  end: number,
  linkMark: PMMark,
  options?: SbRichTextOptions,
): string {
  let inner = '';
  for (let i = start; i < end; i++) {
    const node = children[i] as TextNode;
    const innerMarks = node.marks?.filter(m => m.type !== 'link');
    inner += renderTextNode(node, innerMarks, options);
  }

  // Custom link renderer
  const customRenderer = options?.renderers?.[linkMark.type as keyof typeof options.renderers];
  if (customRenderer) {
    return (customRenderer as (props: typeof linkMark & { children: string }) => string)({
      ...linkMark,
      children: inner,
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
  rows: SbRichTextDoc[] | undefined,
  options?: SbRichTextOptions,
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
      result += renderNode(rows[i], options);
    }
    result += '</thead>';
  }

  if (headerEnd < rows.length) {
    result += '<tbody>';
    for (let i = headerEnd; i < rows.length; i++) {
      result += renderNode(rows[i], options);
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
function buildHtmlAttrs(type: SbRichTextElement, attrs: Record<string, unknown> | undefined): string {
  const processed = processAttrs(type, attrs, {
    colspan: 'colspan',
    rowspan: 'rowspan',
  });

  const styleObj = processed.style as Record<string, AttrValue> | undefined;
  const finalAttrs: Record<string, unknown> = { ...processed };

  if (styleObj) {
    finalAttrs.style = styleToString(styleObj);
  }

  return attrsToHtmlString(finalAttrs);
}

/** Converts attribute record to HTML string: ` key="value" key2="value2"` */
function attrsToHtmlString(attrs: Record<string, unknown>): string {
  let result = '';

  for (const key in attrs) {
    const value = attrs[key];
    if (value != null) {
      result += ` ${key}="${escapeAttr(value)}"`;
    }
  }

  return result;
}
