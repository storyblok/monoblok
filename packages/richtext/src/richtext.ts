import { optimizeImage } from './images-optimization';
import { BlockTypes, LinkTypes, MarkTypes, TextTypes } from './types';
import type { MarkNode, StoryblokRichTextContext, StoryblokRichTextNode, StoryblokRichTextNodeResolver, StoryblokRichTextNodeTypes, StoryblokRichTextOptions, TextNode } from './types';
import { attrsToString, attrsToStyle, cleanObject, escapeHtml, SELF_CLOSING_TAGS } from './utils';

/**
 * Default render function that creates an HTML string for a given tag, attributes, and children.
 *
 * @template T
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {T} children
 * @return {*}  {T}
 */
function defaultRenderFn<T = string | null>(tag: string, attrs: Record<string, any> = {}, children?: T): T {
  const attrsString = attrsToString(attrs);
  const tagString = attrsString ? `${tag} ${attrsString}` : tag;
  const content = Array.isArray(children) ? children.join('') : children || '';

  if (!tag) {
    return content as unknown as T;
  }
  else if (SELF_CLOSING_TAGS.includes(tag)) {
    return `<${tagString}>` as unknown as T;
  }
  return `<${tagString}>${content}</${tag}>` as unknown as T;
}

/**
 * Creates a rich text resolver with the given options.
 *
 * @export
 * @template T
 * @param {StoryblokRichTextOptions<T>} [options]
 * @return {*}
 */
export function richTextResolver<T>(options: StoryblokRichTextOptions<T> = {}) {
  const keyCounters = new Map<string, number>();

  const {
    renderFn = defaultRenderFn,
    textFn = escapeHtml,
    resolvers = {},
    optimizeImages = false,
    keyedResolvers = false,
  } = options;
  const isExternalRenderFn = renderFn !== defaultRenderFn;

  const nodeResolver = (tag: string): StoryblokRichTextNodeResolver<T> =>
    (node: StoryblokRichTextNode<T>, context): T => {
      const attributes = node.attrs || {};
      return context.render(tag, attributes, node.children || null as any) as T;
    };

  const imageResolver: StoryblokRichTextNodeResolver<T> = (node: StoryblokRichTextNode<T>, context) => {
    const { src, alt, title, srcset, sizes } = node.attrs || {};
    let finalSrc = src;
    let finalAttrs = {};

    if (optimizeImages) {
      const { src: optimizedSrc, attrs: optimizedAttrs } = optimizeImage(src, optimizeImages);
      finalSrc = optimizedSrc;
      finalAttrs = optimizedAttrs;
    }

    const imgAttrs = {
      src: finalSrc,
      alt,
      title,
      srcset,
      sizes,
      ...finalAttrs,
    };

    return context.render('img', cleanObject(imgAttrs)) as T;
  };

  const headingResolver: StoryblokRichTextNodeResolver<T> = (node: StoryblokRichTextNode<T>, context): T => {
    const { level, ...rest } = node.attrs || {};
    return context.render(`h${level}`, rest, node.children) as T;
  };

  const emojiResolver: StoryblokRichTextNodeResolver<T> = (node: StoryblokRichTextNode<T>, context) => {
    const internalImg = context.render('img', {
      src: node.attrs?.fallbackImage,
      alt: node.attrs?.alt,
      style: 'width: 1.25em; height: 1.25em; vertical-align: text-top',
      draggable: 'false',
      loading: 'lazy',
    }) as T;

    return context.render('span', {
      'data-type': 'emoji',
      'data-name': node.attrs?.name,
      'data-emoji': node.attrs?.emoji,
    }, internalImg) as T;
  };

  const codeBlockResolver: StoryblokRichTextNodeResolver<T> = (node: StoryblokRichTextNode<T>, context): T => {
    return context.render('pre', node.attrs || {}, context.render('code', {}, node.children || '' as any),
    ) as T;
  };

  const markResolver = (tag: string, styled = false): StoryblokRichTextNodeResolver<T> => ({ text, attrs }, context): T => {
    const { class: className, id: idName, ...styleAttrs } = attrs || {};
    const attributes = styled
      ? {
          class: className,
          id: idName,
          style: attrsToStyle(styleAttrs) || undefined,
        }
      : attrs || {};

    return context.render(tag, cleanObject(attributes), text as any) as T;
  };

  const renderToT = (node: any): T => {
    // Implementation that ensures the return type is T
    // This might involve checking the type of T and handling accordingly
    return render(node) as unknown as T;
  };

  const textResolver: StoryblokRichTextNodeResolver<T> = (node: StoryblokRichTextNode<T>): T => {
    const { marks, ...rest } = node as TextNode<T>;
    if ('text' in node) {
      if (marks) {
        return marks.reduce(
          (text: T, mark: MarkNode<T>) => renderToT({ ...mark, text }) as T,
          renderToT({ ...rest, children: rest.children as T }) as T,
        );
      }
      const attributes = node.attrs || {};
      if (keyedResolvers) {
        const currentCount = keyCounters.get('txt') || 0;
        keyCounters.set('txt', currentCount + 1);
        attributes.key = `${'txt'}-${currentCount}`;
      }
      return textFn(rest.text, attributes) as T;
    }
    return '' as T;
  };

  const linkResolver: StoryblokRichTextNodeResolver<T> = (node: StoryblokRichTextNode<T>, context) => {
    const { linktype, href, anchor, ...rest } = node.attrs || {};

    let finalHref = '';
    switch (linktype) {
      case LinkTypes.ASSET:
      case LinkTypes.URL:
        finalHref = href;
        break;
      case LinkTypes.EMAIL:
        finalHref = `mailto:${href}`;
        break;
      case LinkTypes.STORY:
        finalHref = href;
        if (anchor) {
          finalHref = `${finalHref}#${anchor}`;
        }
        break;
      default:
        finalHref = href;
        break;
    }
    const attributes: Record<string, any> = { ...rest };
    if (finalHref) {
      attributes.href = finalHref;
    }
    return context.render('a', attributes, node.text as any) as T;
  };

  const componentResolver: StoryblokRichTextNodeResolver<T> = (node: StoryblokRichTextNode<T>, context): T => {
    console.warn('[StoryblokRichtText] - BLOK resolver is not available for vanilla usage');
    return context.render('span', {
      blok: node?.attrs?.body[0],
      id: node.attrs?.id,
      style: 'display: none',
    }) as T;
  };

  const tableResolver: StoryblokRichTextNodeResolver<T> = (node: StoryblokRichTextNode<T>, context): T => {
    const attributes: Record<string, unknown> = {};

    // Wrap children in tbody to ensure proper table structure
    const tableBody = context.render('tbody', {}, node.children) as T;
    return context.render('table', attributes, tableBody) as T;
  };

  const tableRowResolver: StoryblokRichTextNodeResolver<T> = (node: StoryblokRichTextNode<T>, context): T => {
    const attributes: Record<string, unknown> = {};

    return context.render('tr', attributes, node.children) as T;
  };

  const tableCellResolver: StoryblokRichTextNodeResolver<T> = (node: StoryblokRichTextNode<T>, context): T => {
    const { colspan, rowspan, colwidth, backgroundColor, ...rest } = node.attrs || {};
    const attributes = {
      ...rest,
    };

    if (colspan > 1) {
      attributes.colspan = colspan;
    }

    if (rowspan > 1) {
      attributes.rowspan = rowspan;
    }

    // Handle both width and background color in style attribute
    const styles: string[] = [];

    if (colwidth) {
      styles.push(`width: ${colwidth}px;`);
    }

    if (backgroundColor) {
      styles.push(`background-color: ${backgroundColor};`);
    }

    if (styles.length > 0) {
      attributes.style = styles.join(' ');
    }

    return context.render('td', cleanObject(attributes), node.children) as T;
  };

  const tableHeaderResolver: StoryblokRichTextNodeResolver<T> = (node: StoryblokRichTextNode<T>, context): T => {
    const { colspan, rowspan, colwidth, backgroundColor, ...rest } = node.attrs || {};
    const attributes = {
      ...rest,
    };

    if (colspan > 1) {
      attributes.colspan = colspan;
    }

    if (rowspan > 1) {
      attributes.rowspan = rowspan;
    }

    // Handle both width and background color in style attribute
    const styles: string[] = [];

    if (colwidth) {
      styles.push(`width: ${colwidth}px;`);
    }

    if (backgroundColor) {
      styles.push(`background-color: ${backgroundColor};`);
    }

    if (styles.length > 0) {
      attributes.style = styles.join(' ');
    }

    return context.render('th', cleanObject(attributes), node.children) as T;
  };

  // Create the original resolvers map with default implementations
  const originalResolvers = new Map<StoryblokRichTextNodeTypes, StoryblokRichTextNodeResolver<T>>([
    [BlockTypes.DOCUMENT, nodeResolver('')],
    [BlockTypes.HEADING, headingResolver],
    [BlockTypes.PARAGRAPH, nodeResolver('p')],
    [BlockTypes.UL_LIST, nodeResolver('ul')],
    [BlockTypes.OL_LIST, nodeResolver('ol')],
    [BlockTypes.LIST_ITEM, nodeResolver('li')],
    [BlockTypes.IMAGE, imageResolver],
    [BlockTypes.EMOJI, emojiResolver],
    [BlockTypes.CODE_BLOCK, codeBlockResolver],
    [BlockTypes.HR, nodeResolver('hr')],
    [BlockTypes.BR, nodeResolver('br')],
    [BlockTypes.QUOTE, nodeResolver('blockquote')],
    [BlockTypes.COMPONENT, componentResolver],
    [TextTypes.TEXT, textResolver],
    [MarkTypes.LINK, linkResolver],
    [MarkTypes.ANCHOR, linkResolver],
    [MarkTypes.STYLED, markResolver('span', true)],
    [MarkTypes.BOLD, markResolver('strong')],
    [MarkTypes.TEXT_STYLE, markResolver('span', true)],
    [MarkTypes.ITALIC, markResolver('em')],
    [MarkTypes.UNDERLINE, markResolver('u')],
    [MarkTypes.STRIKE, markResolver('s')],
    [MarkTypes.CODE, markResolver('code')],
    [MarkTypes.SUPERSCRIPT, markResolver('sup')],
    [MarkTypes.SUBSCRIPT, markResolver('sub')],
    [MarkTypes.HIGHLIGHT, markResolver('mark')],
    [BlockTypes.TABLE, tableResolver],
    [BlockTypes.TABLE_ROW, tableRowResolver],
    [BlockTypes.TABLE_CELL, tableCellResolver],
    [BlockTypes.TABLE_HEADER, tableHeaderResolver],
  ]);

  // Create the merged resolvers map that includes user overrides
  const mergedResolvers = new Map<StoryblokRichTextNodeTypes, StoryblokRichTextNodeResolver<T>>([
    ...originalResolvers,
    ...(Object.entries(resolvers).map(([type, resolver]) => [type as StoryblokRichTextNodeTypes, resolver])) as unknown as Array<[StoryblokRichTextNodeTypes, StoryblokRichTextNodeResolver<T>]>,
  ]);

  const createRenderContext = () => {
    const contextRenderFn = (tag: string, attrs: Record<string, any> = {}, children?: T): T => {
      if (keyedResolvers && tag) {
        const currentCount = keyCounters.get(tag) || 0;
        keyCounters.set(tag, currentCount + 1);
        attrs.key = `${tag}-${currentCount}`;
      }
      return renderFn(tag, attrs, children);
    };
    const context: StoryblokRichTextContext<T> = {
      render: contextRenderFn,
      originalResolvers,
      mergedResolvers,
    };
    return context;
  };

  function renderNode(node: StoryblokRichTextNode<T>): T {
    const resolver = mergedResolvers.get(node.type);
    if (!resolver) {
      console.error('<Storyblok>', `No resolver found for node type ${node.type}`);
      return '' as unknown as T;
    }

    const context = createRenderContext();

    if (node.type === 'text') {
      return resolver(node as StoryblokRichTextNode<T>, context);
    }

    const children = node.content ? node.content.map(render) : undefined;

    return resolver({
      ...node,
      children: children as T,
    }, context);
  }

  /**
   * Renders a rich text node coming from Storyblok.
   *
   * @param {StoryblokRichTextNode<T>} node
   * @return {*}  {T}
   *
   * @example
   *
   * ```typescript
   * import StoryblokClient from 'storyblok-js-client'
   * import { richTextResolver } from '@storyblok/richtext'
   *
   * const storyblok = new StoryblokClient({
   *  accessToken:  import.meta.env.VITE_STORYBLOK_TOKEN,
   * })
   *
   * const story = await client.get('cdn/stories/home', {
   *  version: 'draft',
   * })
   *
   * const html = richTextResolver().render(story.data.story.content.richtext)
   * ```
   *
   */
  function render(node: StoryblokRichTextNode<T>): T {
    if (node.type === 'doc') {
      return isExternalRenderFn ? node.content.map(renderNode) as T : node.content.map(renderNode).join('') as T;
    }
    return Array.isArray(node) ? node.map(renderNode) as T : renderNode(node) as T;
  }

  return {
    render,
  };
}
