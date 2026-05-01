import { escapeHtml } from '../utils';
import { escapeAttr, processAttrs } from './attribute';
import { styleToString } from './style';
import type { RenderSpec, StoryblokRichTextJson, StoryblokRichTextRendererOptions } from './types';
import type { PMNode } from './types.generated';
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

  // Render children content
  const childContent = node.content
    ? node.content.map(child => renderNode(child, options)).join('')
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

/** Renders static children structure (e.g., table > tbody, pre > code). */
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
