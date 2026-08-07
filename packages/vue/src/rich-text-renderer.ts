import type { Component, VNode } from 'vue';
import { createTextVNode, h, toRaw } from 'vue';
import type {
  StoryblokRichTextElement,
  StoryblokRichTextElementByType,
  StoryblokRichTextImageOptions,
  StoryblokRichTextInput,
  StoryblokRichTextMark,
  StoryblokRichTextNodeWithKey,
  StoryblokRichTextRenderSpec,
  StoryblokRichTextTextNode,
} from '@storyblok/richtext';
import {
  buildStoryblokImage,
  getInnerMarks,
  getStaticChildren,
  groupLinkNodes,
  hasContent,
  isSelfClosing,
  normalizeNodes,
  processAttrs,
  resolveTag,
  splitTableRows,
} from '@storyblok/richtext';

export interface StoryblokVueRichTextRenderContext {
  optimizeImage?: boolean | Partial<StoryblokRichTextImageOptions>;
  components?: StoryblokVueRichTextComponentMap;
  data?: unknown;
}

/**
 * @deprecated Use {@link StoryblokVueRichTextRenderContext} instead. Will be removed in the next major version.
 */
export type SbVueRichTextRenderContext = StoryblokVueRichTextRenderContext;

export type StoryblokVueRichTextProps = StoryblokRichTextElementByType<StoryblokVueRichTextRenderContext>;

/**
 * @deprecated Use {@link StoryblokVueRichTextProps} instead. Will be removed in the next major version.
 */
export type SbVueRichTextProps = StoryblokVueRichTextProps;

export type StoryblokVueRichTextComponentMap = {
  [K in StoryblokRichTextElement]?: Component<StoryblokVueRichTextProps[K]>;
};

/**
 * @deprecated Use {@link StoryblokVueRichTextComponentMap} instead. Will be removed in the next major version.
 */
export type SbVueRichTextComponentMap = StoryblokVueRichTextComponentMap;

/** Props for the `<StoryblokRichText>` Vue component. */
export interface StoryblokVueRichTextComponentProps extends StoryblokVueRichTextRenderContext {
  document?: StoryblokRichTextInput;
}

function resolveComponentOverride<K extends StoryblokRichTextElement>(
  type: K,
  components?: StoryblokVueRichTextComponentMap,
): Component<StoryblokVueRichTextProps[K]> | undefined {
  const comp = components?.[type] as Component<StoryblokVueRichTextProps[K]> | undefined;
  return comp ? toRaw(comp) : undefined;
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
export function createRichTextRenderer(options: StoryblokVueRichTextRenderContext) {
  return function render(document: StoryblokRichTextInput): VNode | VNode[] | null {
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
function renderChildren(nodes: StoryblokRichTextNodeWithKey[], options: StoryblokVueRichTextRenderContext): VNode[] {
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
  nodes: StoryblokRichTextNodeWithKey[],
  linkMark: StoryblokRichTextMark,
  options: StoryblokVueRichTextRenderContext,
  key: number | string,
): VNode {
  const inner = nodes.map((node, index) => {
    const textNode = node as StoryblokRichTextTextNode;
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
  const attrs = ('attrs' in linkMark ? linkMark.attrs : {}) as Record<string, unknown>;
  return h(tag, { key, ...processAttrs(linkMark.type, attrs) }, inner);
}

function renderNode(node: StoryblokRichTextNodeWithKey, options: StoryblokVueRichTextRenderContext, key: number | string): VNode {
  const content = hasContent(node) ? renderChildren(node.content, options) : [];

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
    return renderTextNode(node as StoryblokRichTextTextNode, options, key);
  }

  const tag = resolveTag(node);

  // Some nodes (e.g. nested docs) don't render an element themselves.
  // Render their children directly instead.
  if (!tag) {
    const children = hasContent(node) ? renderChildren(node.content, options) : [];
    if (children.length === 0) {
      return createTextVNode('');
    }
    return children.length === 1 ? children[0] : h('div', { key }, children);
  }
  if (node.type === 'image' && options.optimizeImage) {
    return renderOptimizedImage(node, options, key);
  }
  const nodeAttrs = ('attrs' in node ? node.attrs : {}) as Record<string, unknown>;
  const props = processAttrs(node.type, nodeAttrs);
  if (isSelfClosing(tag)) {
    return h(tag, { key, ...props });
  }
  if (node.type === 'table') {
    return renderTable(node, options, key, tag, props);
  }
  const staticChildren = getStaticChildren(node);
  if (staticChildren) {
    const nodeContent = hasContent(node) ? renderChildren(node.content, options) : [];
    const inner = renderStaticStructure(node.type, staticChildren, nodeAttrs, nodeContent);
    return h(tag, { key }, inner);
  }

  const children = hasContent(node) ? renderChildren(node.content, options) : [];
  if (node.type === 'emoji') {
    const emojiNode = node as Extract<StoryblokRichTextNodeWithKey, { type: 'emoji' }>;
    return h(tag, { key, ...props }, [createTextVNode(emojiNode.attrs.emoji)]);
  }
  return h(tag, { key, ...props }, children);
}

/**
 * Renders an image node with optimization applied.
 */
function renderOptimizedImage(
  node: StoryblokRichTextNodeWithKey,
  options: StoryblokVueRichTextRenderContext,
  key: number | string,
): VNode {
  const attrs = ('attrs' in node ? node.attrs : undefined) as Record<string, unknown> | undefined;
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
  node: StoryblokRichTextNodeWithKey,
  options: StoryblokVueRichTextRenderContext,
  key: number | string,
  tag: string,
  props: Record<string, unknown>,
): VNode {
  const { headerRows, bodyRows } = splitTableRows(node.content);

  const tableContent: VNode[] = [];

  if (headerRows.length > 0) {
    tableContent.push(
      h('thead', { key: 'thead' }, headerRows.map((row, index) => renderNode(row, options, row._key || index))),
    );
  }

  if (bodyRows.length > 0) {
    tableContent.push(
      h('tbody', { key: 'tbody' }, bodyRows.map((row, index) => renderNode(row, options, row._key || index))),
    );
  }

  return h(tag, { key, ...props }, tableContent);
}

/**
 * Renders nested static structure defined in render map (e.g., pre > code).
 */
function renderStaticStructure(
  type: StoryblokRichTextElement,
  specs: readonly StoryblokRichTextRenderSpec[],
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

function renderTextNode(node: StoryblokRichTextTextNode, options: StoryblokVueRichTextRenderContext, key?: number | string): VNode {
  return renderTextNodeWithMarks(node, node.marks, options, key);
}

function renderTextNodeWithMarks(
  node: StoryblokRichTextTextNode,
  marks: StoryblokRichTextMark[] | undefined,
  options: StoryblokVueRichTextRenderContext,
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

function wrapMark(children: VNode | string, mark: StoryblokRichTextMark, options: StoryblokVueRichTextRenderContext): VNode {
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
  const attrs = ('attrs' in mark ? mark.attrs : {}) as Record<string, unknown>;
  return h(tag, processAttrs(mark.type, attrs), typeof children === 'string' ? children : [children]);
}
