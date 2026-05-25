import type { Component, MaybeRefOrGetter, VNode, VNodeChild } from 'vue';
import { computed, createTextVNode, h, toValue } from 'vue';
import type {
  BaseSbRichTextProps,
  RenderSpec,
  SbRichTextElement,
  SbRichTextImageOptions,
  SbRichTextMark,
  SbRichTextNode,
  SbRichTextTextNode,
} from '@storyblok/richtext';
import {
  buildStoryblokImage,
  getInnerMarks,
  getStaticChildren,
  groupLinkNodes,
  isSelfClosing,
  processAttrs,
  resolveTag,
  splitTableRows,
} from '@storyblok/richtext';

/**
 * Props type for Vue richtext node/mark components.
 * Content is passed via the default slot, not as a prop.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import type { SbVueRichTextProps } from '@storyblok/vue';
 *
 * defineProps<SbVueRichTextProps<'heading'>>();
 * </script>
 *
 * <template>
 *   <h1 class="custom-heading">
 *     <slot />
 *   </h1>
 * </template>
 * ```
 */
export type SbVueRichTextProps<
  T extends SbRichTextElement,
> = BaseSbRichTextProps<T, { children?: VNodeChild; components?: SbVueRichTextComponentMap }, { children?: VNodeChild }>;
/**
 * Type-safe component map for Vue richtext renderer.
 * Components receive node/mark props and content via the default slot.
 */

export type RichTextRenderer<TProps> =
  | Component<TProps>
  | ((props: TProps) => VNodeChild);

export type SbVueRichTextComponentMap = {
  [K in SbRichTextElement]?: RichTextRenderer<
    SbVueRichTextProps<K>
  >;
};
function resolveComponentOverride<K extends SbRichTextElement>(
  type: K,
  components?: SbVueRichTextComponentMap,
): Component<SbVueRichTextProps<K>> | undefined {
  return components?.[type] as Component<SbVueRichTextProps<K>> | undefined;
}

export interface StoryblokRichTextRendererOptions {
  optimizeImage?: boolean | Partial<SbRichTextImageOptions>;
  components?: SbVueRichTextComponentMap;
}

export interface StoryblokRichTextProps extends StoryblokRichTextRendererOptions {
  document: MaybeRefOrGetter<SbRichTextNode | SbRichTextNode[] | null | undefined>;
}

interface CreateRichTextHookOptions {
  isServerContext?: boolean;
}

/**
 * Creates a richtext hook factory with a custom StoryblokComponent.
 */
export function createRichTextHook(
  StoryblokComp: Component,
  _options?: CreateRichTextHookOptions,
) {
  return function useRichText({ document, optimizeImage, components }: StoryblokRichTextProps) {
    const render = useStoryblokRichText({
      optimizeImage,
      components: {
        ...components,
        blok: ({ attrs }: SbVueRichTextProps<'blok'>) =>
          Array.isArray(attrs?.body)
            ? attrs.body.map((blok, index) =>
                h(StoryblokComp, {
                  blok,
                  key: blok._uid || index,
                }),
              )
            : null,
      },
    });

    return computed(() => render(toValue(document)));
  };
}

/**
 * Vue composable for rendering Storyblok rich text content.
 * Returns a render function that converts rich text JSON to VNodes.
 */
export function useStoryblokRichText(options: StoryblokRichTextRendererOptions = {}) {
  return createStoryblokRenderer(options);
}

/**
 * Creates a renderer function for Storyblok rich text.
 */
export function createStoryblokRenderer(options: StoryblokRichTextRendererOptions) {
  return function render(document: SbRichTextNode | SbRichTextNode[] | null | undefined): VNode | VNode[] | null {
    if (!document) {
      return null;
    }

    if (Array.isArray(document)) {
      const children = renderChildren(document, options);
      return children.length === 1 ? children[0] : children;
    }

    const nodes = document.type === 'doc' ? document.content : [document];
    if (!nodes?.length) {
      return null;
    }

    const children = renderChildren(nodes, options);
    return children.length === 1 ? children[0] : children;
  };
}

/**
 * Renders child nodes, merging adjacent text nodes that share the same link mark.
 * This produces cleaner output: <a href="...">text <strong>bold</strong> more</a>
 * instead of: <a>text</a><a><strong>bold</strong></a><a>more</a>
 */
function renderChildren(nodes: SbRichTextNode[], options: StoryblokRichTextRendererOptions): VNode[] {
  const groups = groupLinkNodes(nodes);

  return groups.map((group, groupIndex) => {
    if (group.linkMark) {
      return renderLinkGroup(group.nodes, group.linkMark, options, groupIndex);
    }
    else {
      return renderNode(group.nodes[0], options, groupIndex);
    }
  });
}

/**
 * Renders consecutive text nodes under a single link tag.
 */
function renderLinkGroup(
  nodes: SbRichTextNode[],
  linkMark: SbRichTextMark,
  options: StoryblokRichTextRendererOptions,
  key: number,
): VNode {
  const inner = nodes.map((node, index) => {
    const textNode = node as SbRichTextTextNode;
    const innerMarks = getInnerMarks(node);
    return renderTextNodeWithMarks(textNode, innerMarks, options, index);
  });

  // Custom link component
  const Custom = resolveComponentOverride(linkMark.type, options.components);
  if (Custom) {
    return h(Custom, { key, ...linkMark }, () => inner);
  }

  const tag = resolveTag(linkMark);
  if (!tag) {
    // No tag resolved - this shouldn't happen for links, but return first child or empty
    return inner.length > 0 ? inner[0] : createTextVNode('');
  }

  const props = buildVueProps(linkMark.type, linkMark.attrs);
  return h(tag, { key, ...props }, inner);
}

function renderNode(node: SbRichTextNode, options: StoryblokRichTextRendererOptions, key: number): VNode {
  // Text node
  if (node.type === 'text') {
    return renderTextNode(node as SbRichTextTextNode, options, key);
  }

  // Custom component override
  const Custom = resolveComponentOverride(node.type, options.components);

  if (Custom) {
    const children = node.content ? renderChildren(node.content, options) : null;
    return h(Custom, { key, ...node }, children ? () => children : undefined);
  }

  // Default element rendering
  const tag = resolveTag(node);

  // No tag (e.g., nested doc): render children directly
  if (!tag) {
    const children = node.content ? renderChildren(node.content, options) : [];
    // Return single child or wrap in div
    if (children.length === 0) {
      return createTextVNode('');
    }
    return children.length === 1 ? children[0] : h('div', { key }, children);
  }

  // Image optimization
  if (node.type === 'image' && options.optimizeImage) {
    return renderOptimizedImage(node, options, key);
  }

  const props = buildVueProps(node.type, node.attrs);

  // Self-closing tags
  if (isSelfClosing(tag)) {
    return h(tag, { key, ...props });
  }

  // Table special handling with thead/tbody
  if (node.type === 'table') {
    return renderTable(node, options, key, tag, props);
  }

  // Static children (e.g., code_block -> pre > code)
  const staticChildren = getStaticChildren(node);
  if (staticChildren) {
    const content = node.content ? renderChildren(node.content, options) : [];
    const inner = renderStaticStructure(node.type, staticChildren, node.attrs, content);
    return h(tag, { key }, inner);
  }

  const children = node.content ? renderChildren(node.content, options) : [];
  return h(tag, { key, ...props }, children);
}

/**
 * Renders an image node with optimization applied.
 */
function renderOptimizedImage(
  node: SbRichTextNode,
  options: StoryblokRichTextRendererOptions,
  key: number,
): VNode {
  const attrs = node.attrs as Record<string, unknown> | undefined;
  const src = attrs?.src as string | undefined;

  if (!src) {
    // Return empty text node for missing src
    return createTextVNode('');
  }

  const { src: optimizedSrc, attrs: extraAttrs } = buildStoryblokImage(src, options.optimizeImage);

  const finalProps = buildVueProps('image', {
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
  options: StoryblokRichTextRendererOptions,
  key: number,
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
    const props = buildVueProps(type, mergedAttrs);

    if (isSelfClosing(tag)) {
      return h(tag, { key: index, ...props });
    }

    const inner = children
      ? renderStaticStructure(type, children, parentAttrs, content)
      : content;

    return h(tag, { key: index, ...props }, inner);
  });
}

function renderTextNode(node: SbRichTextTextNode, options: StoryblokRichTextRendererOptions, key?: number): VNode {
  return renderTextNodeWithMarks(node, node.marks, options, key);
}

function renderTextNodeWithMarks(
  node: SbRichTextTextNode,
  marks: SbRichTextMark[] | undefined,
  options: StoryblokRichTextRendererOptions,
  _key?: number,
): VNode {
  let content: VNode | string = node.text;

  if (marks?.length) {
    for (const mark of marks) {
      content = wrapMark(content, mark, options);
    }
  }

  // If content is still a string, create a text VNode
  if (typeof content === 'string') {
    return createTextVNode(content);
  }

  return content;
}

function wrapMark(children: VNode | string, mark: SbRichTextMark, options: StoryblokRichTextRendererOptions): VNode {
  const Custom = resolveComponentOverride(mark.type, options.components);
  if (Custom) {
    const childContent = typeof children === 'string' ? createTextVNode(children) : children;
    return h(Custom, { ...mark }, () => childContent);
  }

  const tag = resolveTag(mark);
  if (!tag) {
    return typeof children === 'string' ? createTextVNode(children) : children;
  }

  const props = buildVueProps(mark.type, mark.attrs);
  return h(tag, props, typeof children === 'string' ? children : [children]);
}

/**
 * Builds Vue props from node/mark type and attrs.
 * Handles class attribute (Vue uses 'class' not 'className').
 */
function buildVueProps(
  type: SbRichTextElement,
  attrs: Record<string, unknown> | undefined,
): Record<string, unknown> {
  // Vue uses 'class' directly, unlike React which needs 'className'
  const processed = processAttrs(type, attrs);
  return processed;
}
