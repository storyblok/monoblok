import type { RenderSpec, SbRichTextElement, SbRichTextElementByType, SbRichTextImageOptions, SbRichTextInput, SbRichTextMark, SbRichTextNode, SbRichTextTextNode } from '@storyblok/richtext';
import { buildStoryblokImage, getInnerMarks, getStaticChildren, groupLinkNodes, isSelfClosing, normalizeNodes, processAttrs, resolveTag, splitTableRows } from '@storyblok/richtext';
import React, { type ComponentType, type ReactNode } from 'react';

/**
 * Props type for React richtext node/mark components.
 * Similar to SbRichTextProps but uses ReactNode for children instead of string.
 */
export type SbReactRichTextProps<
  T extends SbRichTextElement,
> =
  SbRichTextElementByType<SbReactRichTextRenderContext>[T]
  & {
    children?: ReactNode;
  };

export type SbReactRichTextComponent<
  T extends SbRichTextElement,
> = ComponentType<SbReactRichTextProps<T>>;

export type SbReactComponentMap = {
  [K in SbRichTextElement]?: SbReactRichTextComponent<K>;
};

export interface SbReactRichTextRenderContext {
  optimizeImage?: boolean | SbRichTextImageOptions;
  components?: SbReactComponentMap;
}
export interface StoryblokRichTextProps extends SbReactRichTextRenderContext {
  optimizeImage?: boolean | SbRichTextImageOptions;
  document?: SbRichTextInput;
}

function resolveComponent<K extends SbRichTextElement>(
  type: K,
  components?: SbReactComponentMap,
): ComponentType<SbReactRichTextProps<K>> | undefined {
  return components?.[type] as ComponentType<SbReactRichTextProps<K>> | undefined;
}

export function createRichTextRenderer(options: SbReactRichTextRenderContext) {
  return function render(document: SbRichTextInput): ReactNode | null {
    const nodes = normalizeNodes(document, true);
    return nodes?.length ? renderChildren(nodes, options) : null;
  };
}

/**
 * Renders child nodes, merging adjacent text nodes that share the same link mark.
 * This produces cleaner output: <a href="...">text <strong>bold</strong> more</a>
 * instead of: <a>text</a><a><strong>bold</strong></a><a>more</a>
 */
function renderChildren(nodes: SbRichTextNode[], options: SbReactRichTextRenderContext): ReactNode {
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
  options: SbReactRichTextRenderContext,
  key: React.Key,
): ReactNode {
  const inner = nodes.map((node, index) => {
    const textNode = node as SbRichTextTextNode;
    const innerMarks = getInnerMarks(node);
    return renderTextNodeWithMarks(textNode, innerMarks, options, node._key || index);
  });
  const Custom = resolveComponent(linkMark.type, options.components);
  if (Custom) {
    return (
      <Custom key={key} {...linkMark}>
        {inner}
      </Custom>
    );
  }

  const tag = resolveTag(linkMark);
  if (!tag) {
    return <React.Fragment key={key}>{inner}</React.Fragment>;
  }

  return React.createElement(tag, { key, ...processAttrs(linkMark.type, linkMark.attrs) }, inner);
}

function renderNode(node: SbRichTextNode, options: SbReactRichTextRenderContext, key: React.Key): ReactNode {
  if (node.type === 'text') {
    return renderTextNode(node as SbRichTextTextNode, options, key);
  }
  const Custom = resolveComponent(node.type, options.components);

  if (Custom) {
    return (
      <Custom key={key} {...node} context={options}>
        {node.content ? renderChildren(node.content, options) : null}
      </Custom>
    );
  }
  const tag = resolveTag(node);
  if (!tag) {
    return node.content ? renderChildren(node.content, options) : null;
  }
  if (node.type === 'image' && options.optimizeImage) {
    return renderOptimizedImage(node, options, key);
  }

  const props = processAttrs(node.type, node.attrs);
  if (isSelfClosing(tag)) {
    return React.createElement(tag, { key, ...props });
  }

  if (node.type === 'table') {
    return renderTable(node, options, key, tag, props);
  }

  const staticChildren = getStaticChildren(node);
  if (staticChildren) {
    const content = node.content ? renderChildren(node.content, options) : null;
    const inner = renderStaticStructure(node.type, staticChildren, node.attrs, content);
    return React.createElement(tag, { key }, inner);
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
  node: SbRichTextNode,
  options: SbReactRichTextRenderContext,
  key: React.Key,
): ReactNode {
  const attrs = node.attrs as Record<string, unknown> | undefined;
  const src = attrs?.src as string | undefined;

  if (!src) {
    return null;
  }

  const { src: optimizedSrc, attrs: extraAttrs } = buildStoryblokImage(src, options.optimizeImage);

  const finalProps = processAttrs('image', {
    ...attrs,
    src: optimizedSrc,
    ...extraAttrs,
  });

  return <img key={key} {...finalProps} />;
}

/**
 * Renders table with thead/tbody grouping based on cell types.
 */
function renderTable(
  node: SbRichTextNode,
  options: SbReactRichTextRenderContext,
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
  type: SbRichTextElement,
  specs: readonly RenderSpec[],
  parentAttrs: Record<string, unknown> | undefined,
  content: ReactNode,
): ReactNode {
  return specs.map((spec, index) => {
    const { tag, children, attrs: specAttrs } = spec;
    const mergedAttrs = { ...specAttrs, ...parentAttrs };
    const props = processAttrs(type, mergedAttrs);

    if (isSelfClosing(tag)) {
      return React.createElement(tag, { key: index, ...props });
    }

    const inner = children
      ? renderStaticStructure(type, children, parentAttrs, content)
      : content;

    return React.createElement(tag, { key: index, ...props }, inner);
  });
}

function renderTextNode(node: SbRichTextTextNode, options: SbReactRichTextRenderContext, key?: React.Key): ReactNode {
  return renderTextNodeWithMarks(node, node.marks, options, key);
}

function renderTextNodeWithMarks(
  node: SbRichTextTextNode,
  marks: SbRichTextMark[] | undefined,
  options: SbReactRichTextRenderContext,
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

function wrapMark(children: ReactNode, mark: SbRichTextMark, options: SbReactRichTextRenderContext): ReactNode {
  const Custom = resolveComponent(mark.type, options.components);
  if (Custom) {
    return <Custom {...mark}>{children}</Custom>;
  }

  const tag = resolveTag(mark);
  if (!tag) {
    return children;
  }

  const props = processAttrs(mark.type, mark.attrs);
  return React.createElement(tag, props, children);
}
