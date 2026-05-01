import { escapeHtml } from '../utils';
import { escapeAttr, processAttrs } from './attribute';
import { styleToString } from './style';
import type { AttrValue, RenderSpec, StoryblokRichTextJson, StoryblokRichTextRendererOptions } from './types';
import type { PMMark, PMNode, TiptapComponentName } from './types.generated';
import { getStaticChildren, isSelfClosing, resolveTag } from './util';

type TextNode = PMNode & { type: 'text' };

/**
 * Renders a Storyblok RichText JSON document to an HTML string.
 *
 * @param document - RichText JSON document, array of nodes, or nullish value
 * @param options - Renderer configuration with custom node/mark renderers
 * @returns Rendered HTML string
 *
 * @example
 * ```ts
 * const html = richTextRenderer({
 *   type: 'doc',
 *   content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }]
 * });
 * // => '<p>Hello</p>'
 * ```
 */
export function richTextRenderer(
  document: StoryblokRichTextJson | StoryblokRichTextJson[] | null | undefined,
  options?: StoryblokRichTextRendererOptions,
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
function renderNode(node: StoryblokRichTextJson, options?: StoryblokRichTextRendererOptions): string {
  // Text nodes: apply marks and escape content
  if (node.type === 'text') {
    return renderTextNode(node as TextNode, node.marks, options);
  }

  // Custom renderer takes full control
  const customRenderer = options?.renderers?.[node.type as keyof typeof options.renderers];
  if (customRenderer) {
    return (customRenderer as (props: typeof node) => string)(node);
  }

  // Blok nodes require custom renderer
  if (node.type === 'blok') {
    console.warn('Rendering of "blok" nodes is not supported in richTextRenderer.');
    return '';
  }

  const tag = resolveTag(node);

  // No tag (e.g., nested doc): render children directly
  if (!tag) {
    return node.content ? renderChildren(node.content, options) : '';
  }

  const htmlAttrs = buildHtmlAttrs(node.type, node.attrs);

  // Self-closing tags
  if (isSelfClosing(tag)) {
    return `<${tag}${htmlAttrs} />`;
  }

  // Table: special thead/tbody grouping
  if (node.type === 'table') {
    return `<${tag}${htmlAttrs}>${renderTableRows(node.content, options)}</${tag}>`;
  }

  const content = node.content ? renderChildren(node.content, options) : '';

  // Static children (e.g., pre > code)
  const staticChildren = getStaticChildren(node);
  if (staticChildren) {
    const inner = renderStaticStructure(staticChildren, node.attrs, content);
    return `<${tag}${htmlAttrs}>${inner}</${tag}>`;
  }

  return `<${tag}${htmlAttrs}>${content}</${tag}>`;
}

/**
 * Renders child nodes, merging adjacent text nodes that share the same link mark.
 * This produces cleaner HTML: `<a href="...">text <b>bold</b> more</a>`
 * instead of: `<a>text</a><a><b>bold</b></a><a>more</a>`
 */
function renderChildren(children: StoryblokRichTextJson[], options?: StoryblokRichTextRendererOptions): string {
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
  options?: StoryblokRichTextRendererOptions,
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
  options?: StoryblokRichTextRendererOptions,
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

// ============================================================================
// Link Mark Merging
// ============================================================================

/** Gets link mark from a text node, or null. */
function getTextNodeLinkMark(node: StoryblokRichTextJson): PMMark | null {
  if (node.type !== 'text' || !node.marks) {
    return null;
  }

  for (const mark of node.marks) {
    if (mark.type === 'link') {
      return mark;
    }
  }
  return null;
}

/** Checks if two link marks have identical attributes. */
function areLinkMarksEqual(a: PMMark | null, b: PMMark | null): boolean {
  if (!a || !b) {
    return false;
  }

  const aa = (a.attrs ?? {}) as Record<string, unknown>;
  const ba = (b.attrs ?? {}) as Record<string, unknown>;

  return (
    aa.href === ba.href
    && aa.target === ba.target
    && aa.linktype === ba.linktype
    && aa.anchor === ba.anchor
    && aa.uuid === ba.uuid
  );
}

/** Renders consecutive text nodes (from start to end) under a single link tag. */
function renderLinkGroup(
  children: StoryblokRichTextJson[],
  start: number,
  end: number,
  linkMark: PMMark,
  options?: StoryblokRichTextRendererOptions,
): string {
  // Render each text node with only its non-link marks
  let inner = '';
  for (let i = start; i < end; i++) {
    const node = children[i] as TextNode;
    const innerMarks = node.marks?.filter(m => m.type !== 'link');
    inner += renderTextNode(node, innerMarks, options);
  }

  const tag = resolveTag(linkMark);
  if (!tag) {
    return inner;
  }

  const htmlAttrs = buildHtmlAttrs(linkMark.type, linkMark.attrs);
  return `<${tag}${htmlAttrs}>${inner}</${tag}>`;
}

// ============================================================================
// Table Rendering
// ============================================================================

/** Renders table rows with thead/tbody grouping based on cell types. */
function renderTableRows(
  rows: StoryblokRichTextJson[] | undefined,
  options?: StoryblokRichTextRendererOptions,
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

  // Render thead
  if (headerEnd > 0) {
    result += '<thead>';
    for (let i = 0; i < headerEnd; i++) {
      result += renderNode(rows[i], options);
    }
    result += '</thead>';
  }

  // Render tbody
  if (headerEnd < rows.length) {
    result += '<tbody>';
    for (let i = headerEnd; i < rows.length; i++) {
      result += renderNode(rows[i], options);
    }
    result += '</tbody>';
  }

  return result;
}

/** Checks if a row contains only tableHeader cells. */
function isTableHeaderRow(row: StoryblokRichTextJson): boolean {
  const cells = row.content;
  if (!cells?.length) {
    return false;
  }

  for (const cell of cells) {
    if (cell.type !== 'tableHeader') {
      return false;
    }
  }
  return true;
}

// Static Children (e.g., pre > code)

/** Renders nested static structure defined in render map. */
function renderStaticStructure(
  specs: readonly RenderSpec[],
  parentAttrs: Record<string, unknown> | undefined,
  content: string,
): string {
  let result = '';

  for (const spec of specs) {
    const { tag, children, attrs: specAttrs } = spec;
    const mergedAttrs = { ...specAttrs, ...parentAttrs };
    const htmlAttrs = attrsToHtmlString(mergedAttrs);

    if (isSelfClosing(tag)) {
      result += `<${tag}${htmlAttrs} />`;
    }
    else {
      const inner = children
        ? renderStaticStructure(children, parentAttrs, content)
        : content;
      result += `<${tag}${htmlAttrs}>${inner}</${tag}>`;
    }
  }

  return result;
}

/** Builds HTML attribute string from node/mark type and attrs. */
function buildHtmlAttrs(type: TiptapComponentName, attrs: Record<string, unknown> | undefined): string {
  const processed = processAttrs(type, attrs, {
    colspan: 'colspan',
    rowspan: 'rowspan',
  });

  // Convert style object to string if present
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
