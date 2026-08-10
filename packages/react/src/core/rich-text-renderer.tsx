import type {
  StoryblokRichTextProps as StoryblokRichTextCoreProps,
  StoryblokRichTextElement,
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
  isSelfClosing,
  normalizeNodes,
  processAttrs,
  resolveTag,
  splitTableRows,
} from '@storyblok/richtext';
import React, { type ComponentType, type ReactNode } from 'react';

/**
 * Props type for React richtext node/mark components.
 * Extends the OpenAPI-sourced StoryblokRichTextCoreProps<T> with a React-specific
 * context and ReactNode children (instead of the static renderer's string children).
 */
export type StoryblokReactRichTextProps<T extends StoryblokRichTextElement> =
  Omit<StoryblokRichTextCoreProps<T>, 'context' | 'children'> & {
    context?: StoryblokReactRichTextRenderContext;
    children?: ReactNode;
  };

/**
 * @deprecated Use {@link StoryblokReactRichTextProps} instead. Will be removed in the next major version.
 */
export type SbReactRichTextProps<T extends StoryblokRichTextElement> =
  StoryblokReactRichTextProps<T>;

export type StoryblokReactRichTextComponent<T extends StoryblokRichTextElement> =
  ComponentType<StoryblokReactRichTextProps<T>>;

/**
 * @deprecated Use {@link StoryblokReactRichTextComponent} instead. Will be removed in the next major version.
 */
export type SbReactRichTextComponent<T extends StoryblokRichTextElement> =
  StoryblokReactRichTextComponent<T>;

export type StoryblokReactRichTextComponentMap = {
  [K in StoryblokRichTextElement]?: StoryblokReactRichTextComponent<K>;
};

/**
 * @deprecated Use {@link StoryblokReactRichTextComponentMap} instead. Will be removed in the next major version.
 */
export type SbReactRichTextComponentMap = StoryblokReactRichTextComponentMap;

export interface StoryblokReactRichTextRenderContext {
  optimizeImage?: boolean | StoryblokRichTextImageOptions;
  components?: StoryblokReactRichTextComponentMap;
  data?: unknown;
}

/**
 * @deprecated Use {@link StoryblokReactRichTextRenderContext} instead. Will be removed in the next major version.
 */
export type SbReactRichTextRenderContext = StoryblokReactRichTextRenderContext;

/** Props for the `<StoryblokRichText>` React component. */
export interface StoryblokReactRichTextComponentProps extends StoryblokReactRichTextRenderContext {
  document?: StoryblokRichTextInput;
}

const extendAttrMap = {
  class: 'className',
};

function resolveComponent<K extends StoryblokRichTextElement>(
  type: K,
  components?: StoryblokReactRichTextComponentMap,
): ComponentType<StoryblokReactRichTextProps<K>> | undefined {
  return components?.[type] as ComponentType<StoryblokReactRichTextProps<K>> | undefined;
}

export function createRichTextRenderer(options: StoryblokReactRichTextRenderContext) {
  return function render(document: StoryblokRichTextInput): ReactNode | null {
    const nodes = normalizeNodes(document, true);
    return nodes?.length ? renderChildren(nodes, options) : null;
  };
}

/**
 * Renders child nodes, merging adjacent text nodes that share the same link mark.
 * This produces cleaner output: <a href="...">text <strong>bold</strong> more</a>
 * instead of: <a>text</a><a><strong>bold</strong></a><a>more</a>
 */
function renderChildren(nodes: StoryblokRichTextNodeWithKey[], options: StoryblokReactRichTextRenderContext): ReactNode {
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
  options: StoryblokReactRichTextRenderContext,
  key: React.Key,
): ReactNode {
  const inner = nodes.map((node, index) => {
    const textNode = node as StoryblokRichTextTextNode;
    const innerMarks = getInnerMarks(node);
    return renderTextNodeWithMarks(textNode, innerMarks, options, node._key || index);
  });
  const Custom = resolveComponent(linkMark.type, options.components);
  if (Custom) {
    return (
      <Custom key={key} {...linkMark} context={options}>
        {inner}
      </Custom>
    );
  }

  const tag = resolveTag(linkMark);
  if (!tag) {
    return <React.Fragment key={key}>{inner}</React.Fragment>;
  }

  const markAttrs = ('attrs' in linkMark ? linkMark.attrs : {}) as Record<string, unknown>;
  return React.createElement(tag, { key, ...processAttrs(linkMark.type, markAttrs, extendAttrMap) }, inner);
}

function renderNode(node: StoryblokRichTextNodeWithKey, options: StoryblokReactRichTextRenderContext, key: React.Key): ReactNode {
  const content = node.type !== 'text' && node.content ? renderChildren(node.content, options) : null;

  // Custom renderer takes full control
  const Custom = resolveComponent(node.type, options.components);

  if (Custom) {
    // When passing context to a custom component, exclude that component type
    // to prevent infinite loops if the custom component uses StoryblokRichText internally
    const contextForCustom = options.components?.[node.type]
      ? { ...options, components: { ...options.components, [node.type]: undefined } }
      : options;
    return (
      <Custom key={key} {...node} context={contextForCustom}>
        {content}
      </Custom>
    );
  }

  if (node.type === 'text') {
    return renderTextNode(node as StoryblokRichTextTextNode, options, key);
  }
  const tag = resolveTag(node);
  if (!tag) {
    return node.content ? renderChildren(node.content, options) : null;
  }
  if (node.type === 'image' && options.optimizeImage) {
    return renderOptimizedImage(node, options, key);
  }

  const nodeAttrs = ('attrs' in node ? node.attrs : {}) as Record<string, unknown>;
  const props = processAttrs(node.type, nodeAttrs, extendAttrMap);
  if (isSelfClosing(tag)) {
    return React.createElement(tag, { key, ...props });
  }

  if (node.type === 'table') {
    return renderTable(node, options, key, tag, props);
  }

  const staticChildren = getStaticChildren(node);
  if (staticChildren) {
    const nodeContent = node.content ? renderChildren(node.content, options) : null;
    const inner = renderStaticStructure(node.type, staticChildren, nodeAttrs, nodeContent);
    return React.createElement(tag, { key }, inner);
  }

  if (node.type === 'emoji') {
    const emojiNode = node as Extract<StoryblokRichTextNodeWithKey, { type: 'emoji' }>;
    return React.createElement(tag, { key, ...props }, emojiNode.attrs.emoji);
  }

  return React.createElement(
    tag,
    { key, ...props },
    node.content ? renderChildren(node.content, options) : null,
  );
}

/**
 * Renders an image node with optimization applied.
 */
function renderOptimizedImage(
  node: StoryblokRichTextNodeWithKey,
  options: StoryblokReactRichTextRenderContext,
  key: React.Key,
): ReactNode {
  const attrs = ('attrs' in node ? node.attrs : undefined) as Record<string, unknown> | undefined;
  const src = attrs?.src as string | undefined;

  if (!src) {
    return null;
  }

  const { src: optimizedSrc, attrs: extraAttrs } = buildStoryblokImage(src, options.optimizeImage);

  const finalProps = processAttrs('image', {
    ...attrs,
    src: optimizedSrc,
    ...extraAttrs,
  }, extendAttrMap);

  return <img key={key} {...finalProps} />;
}

/**
 * Renders table with thead/tbody grouping based on cell types.
 */
function renderTable(
  node: StoryblokRichTextNodeWithKey,
  options: StoryblokReactRichTextRenderContext,
  key: React.Key,
  tag: string,
  props: Record<string, unknown>,
): ReactNode {
  const { headerRows, bodyRows } = splitTableRows(node.content);

  const tableContent: ReactNode[] = [];

  if (headerRows.length > 0) {
    tableContent.push(
      <thead key="thead">
        {headerRows.map((row, index) => renderNode(row, options, row._key || index))}
      </thead>,
    );
  }

  if (bodyRows.length > 0) {
    tableContent.push(
      <tbody key="tbody">
        {bodyRows.map((row, index) => renderNode(row, options, row._key || index))}
      </tbody>,
    );
  }

  return React.createElement(tag, { key, ...props }, tableContent);
}

/**
 * Renders nested static structure defined in render map (e.g., pre > code).
 */
function renderStaticStructure(
  type: StoryblokRichTextElement,
  specs: readonly StoryblokRichTextRenderSpec[],
  parentAttrs: Record<string, unknown> | undefined,
  content: ReactNode,
): ReactNode {
  return specs.map((spec, index) => {
    const { tag, children, attrs: specAttrs } = spec;
    const mergedAttrs = { ...specAttrs, ...parentAttrs };
    const props = processAttrs(type, mergedAttrs, extendAttrMap);

    if (isSelfClosing(tag)) {
      return React.createElement(tag, { key: index, ...props });
    }

    const inner = children
      ? renderStaticStructure(type, children, parentAttrs, content)
      : content;

    return React.createElement(tag, { key: index, ...props }, inner);
  });
}

function renderTextNode(node: StoryblokRichTextTextNode, options: StoryblokReactRichTextRenderContext, key?: React.Key): ReactNode {
  return renderTextNodeWithMarks(node, node.marks, options, key);
}

function renderTextNodeWithMarks(
  node: StoryblokRichTextTextNode,
  marks: StoryblokRichTextMark[] | undefined,
  options: StoryblokReactRichTextRenderContext,
  key?: React.Key,
): ReactNode {
  let content: ReactNode = node.text;

  if (marks?.length) {
    for (const mark of marks) {
      content = wrapMark(content, mark, options);
    }
  }

  return <React.Fragment key={key}>{content}</React.Fragment>;
}

function wrapMark(children: ReactNode, mark: StoryblokRichTextMark, options: StoryblokReactRichTextRenderContext): ReactNode {
  const Custom = resolveComponent(mark.type, options.components);
  if (Custom) {
    return <Custom {...mark} context={options}>{children}</Custom>;
  }

  const tag = resolveTag(mark);
  if (!tag) {
    return children;
  }

  const markAttrs = ('attrs' in mark ? mark.attrs : {}) as Record<string, unknown>;
  const props = processAttrs(mark.type, markAttrs, extendAttrMap);
  return React.createElement(tag, props, children);
}
