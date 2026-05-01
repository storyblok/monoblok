import { escapeHtml } from '../utils';
import { escapeAttr, processAttrs } from './attribute';
import { styleToString } from './style';
import type { RenderSpec, StoryblokRichTextJson, StoryblokRichTextRendererOptions } from './types';
import type { PMMark, PMNode } from './types.generated';
import { getStaticChildren, isSelfClosing, resolveTag } from './util';

/**
 * Renders a Storyblok RichText JSON document to an HTML string.
 *
 * This is a framework-agnostic static renderer that supports Storyblok
 * richtext nodes and marks, applies attributes and styles, and safely
 * escapes text content. `blok` nodes are not rendered and will log a warning.
 *
 * @param document - The Storyblok RichText JSON document, array of nodes, or nullish value
 * @param options - Optional renderer configuration including custom renderers
 * @returns The rendered HTML string
 *  @example
 * ```ts
 * const html = richTextRenderer({
 *   type: 'doc',
 *   content: [
 *     {
 *       type: 'paragraph',
 *       content: [
 *         { type: 'text', text: 'Hello World' }
 *       ]
 *     }
 *   ]
 * });
 *
 * console.log(html);
 * // <p>Hello World</p>
 * ```
 */
export function richTextRenderer(document: StoryblokRichTextJson | StoryblokRichTextJson[] | null | undefined, options?: StoryblokRichTextRendererOptions): string {
  if (!document) {
    return '';
  }

  // Handle array of nodes
  if (Array.isArray(document)) {
    if (document.length === 0) {
      return '';
    }
    return document.map(node => renderNode(node, options)).join('');
  }

  // Handle single node or doc
  const nodes = document.type === 'doc' ? document.content : [document];

  if (!nodes || nodes.length === 0) {
    return '';
  }

  const parts: string[] = [];
  for (const node of nodes) {
    parts.push(renderNode(node, options));
  }
  return parts.join('');
}

/** Renders a single node to HTML. */
function renderNode(node: StoryblokRichTextJson, options?: StoryblokRichTextRendererOptions): string {
  if (node.type === 'text') {
    return renderText(node, options);
  }
  // Check for custom renderer
  const customRenderer = options?.renderers?.[node.type as keyof typeof options.renderers];

  if (node.type === 'blok' && !customRenderer) {
    console.warn('Rendering of "blok" nodes is not supported in richTextRenderer.');
    return '';
  }

  if (customRenderer) {
    return (customRenderer as (props: typeof node) => string)(node);
  }

  const tag = resolveTag(node);
  if (!tag) {
    // For nodes without a tag (like nested `doc`), render children directly
    if (node.content) {
      return node.content.map(child => renderNode(child, options)).join('');
    }
    return '';
  }

  const selfClosing = isSelfClosing(tag);
  const staticChildren = getStaticChildren(node);
  const attrs = processAttrs(node.type, node.attrs, {
    colspan: 'colspan',
    rowspan: 'rowspan',
  });
  const styleString = attrs.style ? styleToString(attrs.style) : '';
  const htmlAttrs = attrsToString({
    ...attrs,
    ...(styleString && { style: styleString }),
  });
  if (selfClosing) {
    return `<${tag}${htmlAttrs} />`;
  }

  // Handle table nodes specially to generate thead/tbody dynamically
  if (node.type === 'table') {
    const tableContent = renderTableContent(node.content, options);
    return `<${tag}${htmlAttrs}>${tableContent}</${tag}>`;
  }

  // Render children content with mark merging for text nodes
  const childContent = node.content
    ? renderChildrenWithMarkMerging(node.content, options)
    : '';

  // Handle static children (e.g., code_block with pre > code structure)
  // Static children are wrapped inside the parent tag
  if (staticChildren) {
    const innerContent = renderStaticChildren(
      staticChildren,
      attrs,
      childContent,
    );
    return `<${tag}${htmlAttrs}>${innerContent}</${tag}>`;
  }

  return `<${tag}${htmlAttrs}>${childContent}</${tag}>`;
}

/**
 * Finds the link mark in a text node's marks array.
 */
function findLinkMark(node: StoryblokRichTextJson): PMMark | null {
  if (node.type !== 'text' || !node.marks) {
    return null;
  }
  return node.marks.find(m => m.type === 'link') ?? null;
}

/**
 * Compares two link marks to check if they have the same attributes.
 */
function linkMarksEqual(a: PMMark | null, b: PMMark | null): boolean {
  if (a === null && b === null) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  if (a.type !== 'link' || b.type !== 'link') {
    return false;
  }

  const aAttrs = (a.attrs ?? {}) as Record<string, unknown>;
  const bAttrs = (b.attrs ?? {}) as Record<string, unknown>;

  // Compare relevant link attributes
  return (
    aAttrs.href === bAttrs.href
    && aAttrs.target === bAttrs.target
    && aAttrs.linktype === bAttrs.linktype
    && aAttrs.anchor === bAttrs.anchor
    && aAttrs.uuid === bAttrs.uuid
  );
}

/**
 * Renders children with mark merging for adjacent text nodes sharing the same link.
 * Groups consecutive text nodes with identical link marks and renders them
 * under a single <a> tag.
 */
function renderChildrenWithMarkMerging(
  children: StoryblokRichTextJson[],
  options?: StoryblokRichTextRendererOptions,
): string {
  const result: string[] = [];
  let i = 0;

  while (i < children.length) {
    const node = children[i];
    const linkMark = findLinkMark(node);

    // If this text node has a link mark, try to merge with subsequent nodes
    if (linkMark) {
      const group: StoryblokRichTextJson[] = [node];
      let j = i + 1;

      // Collect all adjacent text nodes with the same link mark
      while (j < children.length) {
        const nextNode = children[j];
        const nextLinkMark = findLinkMark(nextNode);

        if (nextLinkMark && linkMarksEqual(linkMark, nextLinkMark)) {
          group.push(nextNode);
          j++;
        }
        else {
          break;
        }
      }

      // Render the group under a single link tag
      result.push(renderLinkGroup(group, linkMark, options));
      i = j;
    }
    else {
      // No link mark, render normally
      result.push(renderNode(node, options));
      i++;
    }
  }

  return result.join('');
}

/**
 * Renders a group of text nodes under a single link tag.
 * Each text node's inner marks (bold, italic, etc.) are preserved.
 */
function renderLinkGroup(
  nodes: StoryblokRichTextJson[],
  linkMark: PMMark,
  options?: StoryblokRichTextRendererOptions,
): string {
  // Render inner content: each text node with its non-link marks
  const innerContent = nodes.map((node) => {
    if (node.type !== 'text') {
      return renderNode(node, options);
    }

    // Filter out the link mark, keep only inner marks
    const innerMarks = node.marks?.filter(m => m.type !== 'link') ?? [];

    // Render text with only inner marks
    return renderTextWithMarks(node as PMNode & { type: 'text' }, innerMarks, options);
  }).join('');

  // Wrap with link tag
  const attrs = processAttrs(linkMark.type, linkMark.attrs);
  const styleString = attrs.style ? styleToString(attrs.style) : '';
  const htmlAttrs = attrsToString({
    ...attrs,
    ...(styleString && { style: styleString }),
  });

  const tag = resolveTag(linkMark);
  if (!tag) {
    return innerContent;
  }

  return `<${tag}${htmlAttrs}>${innerContent}</${tag}>`;
}

/**
 * Renders a text node with a specific set of marks.
 */
function renderTextWithMarks(
  node: PMNode & { type: 'text' },
  marks: PMMark[],
  options?: StoryblokRichTextRendererOptions,
): string {
  let result = escapeHtml(node.text);

  if (marks.length === 0) {
    return result;
  }

  // Apply marks in order (innermost first)
  for (const mark of marks) {
    const customRenderer = options?.renderers?.[mark.type as keyof typeof options.renderers];
    if (customRenderer) {
      result = (customRenderer as (props: typeof mark & { children: string }) => string)({
        ...mark,
        children: result,
      });
      continue;
    }

    const tag = resolveTag(mark);
    if (!tag) {
      continue;
    }

    const attrs = processAttrs(mark.type, mark.attrs);
    const styleString = attrs.style ? styleToString(attrs.style) : '';
    const htmlAttrs = attrsToString({
      ...attrs,
      ...(styleString && { style: styleString }),
    });
    result = `<${tag}${htmlAttrs}>${result}</${tag}>`;
  }

  return result;
}

/**
 * Checks if a table row contains header cells.
 * A row is considered a header row if all its cells are tableHeader type.
 */
function isHeaderRow(row: StoryblokRichTextJson): boolean {
  if (row.type !== 'tableRow' || !row.content || row.content.length === 0) {
    return false;
  }
  return row.content.every(cell => cell.type === 'tableHeader');
}

/**
 * Renders table content with proper thead/tbody grouping.
 * Header rows (containing only tableHeader cells) go into thead,
 * body rows (containing tableCell cells) go into tbody.
 */
function renderTableContent(
  rows: StoryblokRichTextJson[] | undefined,
  options?: StoryblokRichTextRendererOptions,
): string {
  if (!rows || rows.length === 0) {
    return '';
  }

  const headerRows: StoryblokRichTextJson[] = [];
  const bodyRows: StoryblokRichTextJson[] = [];

  // Separate header rows from body rows
  // Header rows must be contiguous at the start
  let inHeader = true;
  for (const row of rows) {
    if (inHeader && isHeaderRow(row)) {
      headerRows.push(row);
    }
    else {
      inHeader = false;
      bodyRows.push(row);
    }
  }

  let result = '';

  if (headerRows.length > 0) {
    const headerContent = headerRows.map(row => renderNode(row, options)).join('');
    result += `<thead>${headerContent}</thead>`;
  }

  if (bodyRows.length > 0) {
    const bodyContent = bodyRows.map(row => renderNode(row, options)).join('');
    result += `<tbody>${bodyContent}</tbody>`;
  }

  return result;
}

/** Renders static children structure (e.g., code_block with pre > code). */
function renderStaticChildren(
  staticChildren: readonly RenderSpec[],
  attrs: Record<string, unknown>,
  parentChildren: string = '',
): string {
  const parts: string[] = [];

  for (const child of staticChildren) {
    const tag = child.tag;
    const selfClosing = isSelfClosing(tag);
    const mergedAttrs = { ...child.attrs, ...attrs };
    const htmlAttrs = attrsToString(mergedAttrs);

    if (selfClosing) {
      parts.push(`<${tag}${htmlAttrs} />`);
      continue;
    }

    const children = child.children
      ? renderStaticChildren(child.children, attrs, parentChildren)
      : parentChildren;

    parts.push(`<${tag}${htmlAttrs}>${children}</${tag}>`);
  }

  return parts.join('');
}

/** Renders a text node with its marks (bold, italic, etc.). */
function renderText(node: PMNode & { type: 'text' }, options?: StoryblokRichTextRendererOptions): string {
  const marks = node.marks;
  // Escape HTML entities in text content to prevent XSS
  let result = escapeHtml(node.text);

  if (!marks || marks.length === 0) {
    return result;
  }

  // Apply marks in order (innermost first)
  for (const mark of marks) {
    // Check for custom mark renderer
    const customRenderer = options?.renderers?.[mark.type as keyof typeof options.renderers];
    if (customRenderer) {
      // Pass mark props + children (the already-rendered inner content)
      result = (customRenderer as (props: typeof mark & { children: string }) => string)({
        ...mark,
        children: result,
      });
      continue;
    }

    const tag = resolveTag(mark);
    if (!tag) {
      continue;
    }

    const attrs = processAttrs(mark.type, mark.attrs);
    const styleString = attrs.style ? styleToString(attrs.style) : '';

    const htmlAttrs = attrsToString({
      ...attrs,
      ...(styleString && { style: styleString }),
    });
    result = `<${tag}${htmlAttrs}>${result}</${tag}>`;
  }

  return result;
}

/** Converts an attributes object to an HTML attribute string. */
function attrsToString(attrs: Record<string, unknown>): string {
  const entries = Object.entries(attrs).filter(([, v]) => v != null);

  if (entries.length === 0) {
    return '';
  }
  const attrParts: string[] = [];
  for (const [key, value] of entries) {
    attrParts.push(`${key}="${escapeAttr(value)}"`);
  }
  return ` ${attrParts.join(' ')}`;
}
