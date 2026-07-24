import type { Component, VNode } from 'vue';
import { createTextVNode, h, toRaw } from 'vue';
import type {
  RenderSpec,
  SbRichTextElement,
  SbRichTextElementByType,
  SbRichTextImageOptions,
  SbRichTextInput,
  SbRichTextMark,
  SbRichTextNode,
  SbRichTextTextNode,
} from '@storyblok/richtext';
import {
  buildStoryblokImage,
  getEmojiText,
  getInnerMarks,
  getStaticChildren,
  groupLinkNodes,
  isSelfClosing,
  normalizeNodes,
  processAttrs,
  resolveTag,
  splitTableRows,
} from '@storyblok/richtext';

export type SbVueRichTextProps = SbRichTextElementByType<SbVueRichTextRenderContext>;

export type SbVueRichTextComponentMap = {
  [K in SbRichTextElement]?: Component<SbVueRichTextProps[K]>;
};

function resolveComponentOverride<K extends SbRichTextElement>(
  type: K,
  components?: SbVueRichTextComponentMap,
): Component<SbVueRichTextProps[K]> | undefined {
  const comp = components?.[type] as Component<SbVueRichTextProps[K]> | undefined;
  return comp ? toRaw(comp) : undefined;
}

export interface SbVueRichTextRenderContext {
  optimizeImage?: boolean | Partial<SbRichTextImageOptions>;
  components?: SbVueRichTextComponentMap;
  data?: unknown;
}

/**
 * Creates a Vue-compatible render function for Storyblok Rich Text documents.
 *
 * This is a factory that binds render-time configuration (such as image
 * optimization and component overrides) and returns a reusable renderer
 * function.
 *
 * The returned function is designed to be used directly inside Vue render
 * functions or setup return functions, and will convert a normalized
 * Storyblok rich text document into Vue VNodes.
 *
 * If the input is null or empty, it returns null.
 */
export function createRichTextRenderer(options: SbVueRichTextRenderContext) {
  return function render(document: SbRichTextInput): VNode | VNode[] | null {
    if (!document) {
      return null;
    }

    const nodes = normalizeNodes(document, true);
    return nodes.length ? renderChildren(nodes, options) : null;
  };
}

/**
 * Renders child nodes, merging adjacent text nodes that share the same link mark.
 * This produces cleaner output: <a href="...">text <strong>bold</strong> more</a>
 * instead of: <a>text</a><a><strong>bold</strong></a><a>more</a>
 */
function renderChildren(nodes: SbRichTextNode[], options: SbVueRichTextRenderContext): VNode[] {
  const groups = groupLinkNodes(nodes);

  return groups.map((group, groupIndex) => {
    if (group.linkMark) {
      return renderLinkGroup(group.nodes, group.linkMark, options, group._key || groupIndex);
    }
    else {
      return renderNode(group.nodes[0], options, group._key || groupIndex);
    }
  });
}

/**
 * Renders consecutive text nodes under a single link tag.
 */
function renderLinkGroup(
  nodes: SbRichTextNode[],
  linkMark: SbRichTextMark,
  options: SbVueRichTextRenderContext,
  key: number | string,
): VNode {
  const inner = nodes.map((node, index) => {
    const textNode = node as SbRichTextTextNode;
    const innerMarks = getInnerMarks(node);
    return renderTextNodeWithMarks(textNode, innerMarks, options, index);
  });
  const Custom = resolveComponentOverride(linkMark.type, options.components);
  if (Custom) {
    return h(Custom, { key, ...linkMark, context: options }, {
      default: () => inner,
    });
  }

  const tag = resolveTag(linkMark);
  if (!tag) {
    return inner.length > 0 ? inner[0] : createTextVNode('');
  }

  return h(tag, { key, ...processAttrs(linkMark.type, linkMark.attrs) }, inner);
}

function renderNode(node: SbRichTextNode, options: SbVueRichTextRenderContext, key: number | string): VNode {
  const content = node.type !== 'text' && node.content ? renderChildren(node.content, options) : [];

  // Custom renderer takes full control
  const Custom = resolveComponentOverride(node.type, options.components);

  if (Custom) {
    // When passing context to a custom component, exclude that component type
    // to prevent infinite loops if the custom component uses StoryblokRichText internally
    const contextForCustom = options.components?.[node.type]
      ? { ...options, components: { ...options.components, [node.type]: undefined } }
      : options;
    return h(Custom, { key, ...node, context: contextForCustom }, content.length
      ? {
          default: () => content,
        }
      : undefined);
  }

  if (node.type === 'text') {
    return renderTextNode(node as SbRichTextTextNode, options, key);
  }

  const tag = resolveTag(node);

  // Some nodes (e.g. nested docs) don't render an element themselves.
  // Render their children directly instead.
  if (!tag) {
    const children = node.content ? renderChildren(node.content, options) : [];
    if (children.length === 0) {
      return createTextVNode('');
    }
    return children.length === 1 ? children[0] : h('div', { key }, children);
  }
  if (node.type === 'image' && options.optimizeImage) {
    return renderOptimizedImage(node, options, key);
  }

  const props = processAttrs(node.type, node.attrs);
  if (isSelfClosing(tag)) {
    return h(tag, { key, ...props });
  }
  if (node.type === 'table') {
    return renderTable(node, options, key, tag, props);
  }
  const staticChildren = getStaticChildren(node);
  if (staticChildren) {
    const content = node.content ? renderChildren(node.content, options) : [];
    const inner = renderStaticStructure(node.type, staticChildren, node.attrs, content);
    return h(tag, { key }, inner);
  }

  const children = node.content ? renderChildren(node.content, options) : [];
  const textContent = getEmojiText(node);
  return h(tag, { key, ...props }, textContent ? [createTextVNode(textContent)] : children);
}

/**
 * Renders an image node with optimization applied.
 */
function renderOptimizedImage(
  node: SbRichTextNode,
  options: SbVueRichTextRenderContext,
  key: number | string,
): VNode {
  const attrs = node.attrs as Record<string, unknown> | undefined;
  const src = attrs?.src as string | undefined;

  if (!src) {
    return createTextVNode('');
  }

  const { src: optimizedSrc, attrs: extraAttrs } = buildStoryblokImage(src, options.optimizeImage);

  const finalProps = processAttrs('image', {
    ...attrs,
    src: optimizedSrc,
    ...extraAttrs,
  });

  return h('img', { key, ...finalProps });
}

/**
 * Renders table with thead/tbody grouping based on cell types.
 */
function renderTable(
  node: SbRichTextNode,
  options: SbVueRichTextRenderContext,
  key: number | string,
  tag: string,
  props: Record<string, unknown>,
): VNode {
  const { headerRows, bodyRows } = splitTableRows(node.content);

  const tableContent: VNode[] = [];

  if (headerRows.length > 0) {
    tableContent.push(
      h('thead', { key: 'thead' }, headerRows.map((row, index) => renderNode(row, options, index))),
    );
  }

  if (bodyRows.length > 0) {
    tableContent.push(
      h('tbody', { key: 'tbody' }, bodyRows.map((row, index) => renderNode(row, options, index))),
    );
  }

  return h(tag, { key, ...props }, tableContent);
}

/**
 * Renders nested static structure defined in render map (e.g., pre > code).
 */
function renderStaticStructure(
  type: SbRichTextElement,
  specs: readonly RenderSpec[],
  parentAttrs: Record<string, unknown> | undefined,
  content: VNode[],
): VNode[] {
  return specs.map((spec, index) => {
    const { tag, children, attrs: specAttrs } = spec;
    const mergedAttrs = { ...specAttrs, ...parentAttrs };
    const props = processAttrs(type, mergedAttrs);

    if (isSelfClosing(tag)) {
      return h(tag, { key: index, ...props });
    }

    const inner = children
      ? renderStaticStructure(type, children, parentAttrs, content)
      : content;

    return h(tag, { key: index, ...props }, inner);
  });
}

function renderTextNode(node: SbRichTextTextNode, options: SbVueRichTextRenderContext, key?: number | string): VNode {
  return renderTextNodeWithMarks(node, node.marks, options, key);
}

function renderTextNodeWithMarks(
  node: SbRichTextTextNode,
  marks: SbRichTextMark[] | undefined,
  options: SbVueRichTextRenderContext,
  _key?: number | string,
): VNode {
  let content: VNode | string = node.text;

  if (marks?.length) {
    for (const mark of marks) {
      content = wrapMark(content, mark, options);
    }
  }

  if (typeof content === 'string') {
    return createTextVNode(content);
  }

  return content;
}

function wrapMark(children: VNode | string, mark: SbRichTextMark, options: SbVueRichTextRenderContext): VNode {
  const Custom = resolveComponentOverride(mark.type, options.components);
  if (Custom) {
    const childContent = typeof children === 'string' ? createTextVNode(children) : children;
    return h(Custom, { ...mark, context: options }, {
      default: () => [childContent],
    });
  }

  const tag = resolveTag(mark);
  if (!tag) {
    return typeof children === 'string' ? createTextVNode(children) : children;
  }
  return h(tag, processAttrs(mark.type, mark.attrs), typeof children === 'string' ? children : [children]);
}
