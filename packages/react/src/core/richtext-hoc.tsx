import type { BaseSbRichTextProps, RenderSpec, SbRichTextElement, SbRichTextImageOptions, SbRichTextMark, SbRichTextNode, SbRichTextProps, SbRichTextTextNode } from '@storyblok/richtext';
import { buildStoryblokImage, getInnerMarks, getStaticChildren, groupLinkNodes, isSelfClosing, normalizeNodes, processAttrs, resolveTag, splitTableRows } from '@storyblok/richtext';
import React, { type ComponentType, type ElementType, type ReactNode, useMemo } from 'react';

/**
 * Props type for React richtext node/mark components.
 * Similar to SbRichTextProps but uses ReactNode for children instead of string.
 */
export type SbReactRichTextProps<T extends SbRichTextElement> =
  BaseSbRichTextProps<T, { children?: ReactNode }, { children?: ReactNode }>;

export type SbReactRichTextComponent<
  T extends SbRichTextElement,
> = ComponentType<SbReactRichTextProps<T>>;
/**
 * Type-safe component map for React richtext renderer
 */
export type SbReactComponentMap = {
  [K in SbRichTextElement]?:
  SbReactRichTextComponent<K>;
};

interface RendererOptions {
  optimizeImage?: boolean | SbRichTextImageOptions;
  components?: SbReactComponentMap;
}

export interface StoryblokRichtextProps extends RendererOptions {
  document: SbRichTextNode | SbRichTextNode[] | null | undefined;
}

interface CreateRichTextHookOptions {
  isServerContext?: boolean;
}
function resolveComponent<K extends SbRichTextElement>(
  type: K,
  components?: SbReactComponentMap,
): ComponentType<SbReactRichTextProps<K>> | undefined {
  return components?.[type] as ComponentType<SbReactRichTextProps<K>> | undefined;
}
export function createRichTextHook(StoryblokComponent: ElementType, _options?: CreateRichTextHookOptions) {
  return function useRichText({ document, optimizeImage, components }: StoryblokRichtextProps) {
    const render = useStoryblokRichText({
      optimizeImage,
      components: {
        ...components,
        blok: ({ attrs }: SbRichTextProps<'blok'>) => (
          <>
            {Array.isArray(attrs?.body) && attrs?.body?.map((blok, index) => (
              <StoryblokComponent blok={blok} key={blok._uid || index} />
            ))}
          </>
        ),
      },
    });

    return render(document);
  };
}
export function useStoryblokRichText({ optimizeImage = false, components }: RendererOptions) {
  const render = useMemo(() => {
    return createStoryblokRenderer({
      optimizeImage,
      components,
    });
  }, [optimizeImage, components]);

  return render;
}

export function createStoryblokRenderer(options: RendererOptions) {
  return function render(document: SbRichTextNode | SbRichTextNode[] | null | undefined) {
    const nodes = normalizeNodes(document);
    return nodes?.length ? renderChildren(nodes, options) : null;
  };
}

/**
 * Renders child nodes, merging adjacent text nodes that share the same link mark.
 * This produces cleaner output: <a href="...">text <strong>bold</strong> more</a>
 * instead of: <a>text</a><a><strong>bold</strong></a><a>more</a>
 */
function renderChildren(nodes: SbRichTextNode[], options: RendererOptions): ReactNode {
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
  options: RendererOptions,
  key: React.Key,
): ReactNode {
  const inner = nodes.map((node, index) => {
    const textNode = node as SbRichTextTextNode;
    const innerMarks = getInnerMarks(node);
    return renderTextNodeWithMarks(textNode, innerMarks, options, index);
  });

  // Custom link component
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

  const props = buildReactProps(linkMark.type, linkMark.attrs);
  return React.createElement(tag, { key, ...props }, inner);
}

function renderNode(node: SbRichTextNode, options: RendererOptions, key: React.Key): ReactNode {
  // Text node
  if (node.type === 'text') {
    return renderTextNode(node as SbRichTextTextNode, options, key);
  }

  // Custom component override
  const Custom = resolveComponent(node.type, options.components);

  if (Custom) {
    return (
      <Custom key={key} {...node}>
        {node.content ? renderChildren(node.content, options) : null}
      </Custom>
    );
  }

  // Default element rendering
  const tag = resolveTag(node);

  // No tag (e.g., nested doc): render children directly
  if (!tag) {
    return node.content ? renderChildren(node.content, options) : null;
  }

  // Image optimization
  if (node.type === 'image' && options.optimizeImage) {
    return renderOptimizedImage(node, options, key);
  }

  const props = buildReactProps(node.type, node.attrs);

  // Self-closing tags
  if (isSelfClosing(tag)) {
    return React.createElement(tag, { key, ...props });
  }

  // Table special handling with thead/tbody
  if (node.type === 'table') {
    return renderTable(node, options, key, tag, props);
  }

  // Static children (e.g., code_block -> pre > code)
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
  options: RendererOptions,
  key: React.Key,
): ReactNode {
  const attrs = node.attrs as Record<string, unknown> | undefined;
  const src = attrs?.src as string | undefined;

  if (!src) {
    return null;
  }

  const { src: optimizedSrc, attrs: extraAttrs } = buildStoryblokImage(src, options.optimizeImage);

  const finalProps = buildReactProps('image', {
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
  options: RendererOptions,
  key: React.Key,
  tag: string,
  props: Record<string, unknown>,
): ReactNode {
  const { headerRows, bodyRows } = splitTableRows(node.content);

  const tableContent: ReactNode[] = [];

  if (headerRows.length > 0) {
    tableContent.push(
      <thead key="thead">
        {headerRows.map((row, index) => renderNode(row, options, index))}
      </thead>,
    );
  }

  if (bodyRows.length > 0) {
    tableContent.push(
      <tbody key="tbody">
        {bodyRows.map((row, index) => renderNode(row, options, index))}
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
    const props = buildReactProps(type, mergedAttrs);

    if (isSelfClosing(tag)) {
      return React.createElement(tag, { key: index, ...props });
    }

    const inner = children
      ? renderStaticStructure(type, children, parentAttrs, content)
      : content;

    return React.createElement(tag, { key: index, ...props }, inner);
  });
}

function renderTextNode(node: SbRichTextTextNode, options: RendererOptions, key?: React.Key): ReactNode {
  return renderTextNodeWithMarks(node, node.marks, options, key);
}

function renderTextNodeWithMarks(
  node: SbRichTextTextNode,
  marks: SbRichTextMark[] | undefined,
  options: RendererOptions,
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

function wrapMark(children: ReactNode, mark: SbRichTextMark, options: RendererOptions): ReactNode {
  const Custom = resolveComponent(mark.type, options.components);
  if (Custom) {
    return <Custom {...mark}>{children}</Custom>;
  }

  const tag = resolveTag(mark);
  if (!tag) {
    return children;
  }

  const props = buildReactProps(mark.type, mark.attrs);
  return React.createElement(tag, props, children);
}

/**
 * Builds React props from node/mark type and attrs.
 * Handles className conversion and style object transformation.
 */
function buildReactProps(
  type: SbRichTextElement,
  attrs: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const processed = processAttrs(type, attrs, {
    class: 'className',
  });

  // Convert style object to React CSSProperties format
  // The style from processAttrs is already an object with camelCase keys
  if (processed.style && typeof processed.style === 'object') {
    // Style is already in the correct format from processAttrs
    return processed as Record<string, unknown>;
  }

  return processed;
}
