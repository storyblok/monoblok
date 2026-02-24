import { getStoryblokExtensions } from './extensions';
import type { BlockAttributes, MarkNode, StoryblokRichTextDocumentNode, StoryblokRichTextNode, StoryblokRichTextOptions, TextNode } from './types';
import { attrsToString, escapeHtml, SELF_CLOSING_TAGS } from './utils';

/**
 * Default render function that creates an HTML string for a given tag, attributes, and children.
 */
function defaultRenderFn<T = string | null>(tag: string, attrs: BlockAttributes = {}, children?: T): T {
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
 * Converts a ProseMirror DOMOutputSpec array to renderFn calls.
 */
function specToRender<T>(
  spec: any[],
  renderFn: (tag: string, attrs?: BlockAttributes, children?: T) => T,
  children: T | undefined,
): T {
  const [tag, ...rest] = spec;
  let attrs: BlockAttributes = {};
  let content = rest;

  // First non-array, non-number, non-null plain object = attributes
  if (
    content.length > 0
    && content[0] !== null
    && content[0] !== undefined
    && typeof content[0] === 'object'
    && !Array.isArray(content[0])
    && typeof content[0] !== 'number'
  ) {
    attrs = content[0] as BlockAttributes;
    content = content.slice(1);
  }

  // Filter nulls (Table extension can produce them)
  content = content.filter((c: any) => c !== null && c !== undefined);

  // No content → self-closing (img, hr, br)
  if (content.length === 0) {
    return renderFn(tag, attrs) as T;
  }

  // Content hole (0) → insert children
  if (content.length === 1 && content[0] === 0) {
    return renderFn(tag, attrs, children) as T;
  }

  // Nested specs → recursive
  const nested = content.map((item: any) => {
    if (item === 0) {
      return children;
    }
    if (Array.isArray(item)) {
      return specToRender(item, renderFn, children);
    }
    return item;
  });

  return renderFn(tag, attrs, nested.length === 1 ? nested[0] : nested) as T;
}

/**
 * Calls renderHTML on a tiptap extension.
 */
function callExtensionRenderHTML(ext: any, type: 'node' | 'mark', attrs: Record<string, any>): any[] {
  const thisContext = { options: ext.options || {}, name: ext.name, type: ext.type };
  if (type === 'node') {
    return ext.config.renderHTML.call(thisContext, {
      node: { attrs },
      HTMLAttributes: attrs,
    });
  }
  return ext.config.renderHTML.call(thisContext, {
    mark: { attrs },
    HTMLAttributes: attrs,
  });
}

/**
 * Creates a rich text resolver with the given options.
 */
export function richTextResolver<T>(options: StoryblokRichTextOptions<T> = {}) {
  const keyCounters = new Map<string, number>();

  const {
    renderFn = defaultRenderFn,
    textFn = escapeHtml,
    optimizeImages = false,
    keyedResolvers = false,
    tiptapExtensions,
  } = options;
  const isExternalRenderFn = renderFn !== defaultRenderFn;

  // Get extensions configured with runtime options, merged with user overrides
  const baseExtensions = getStoryblokExtensions({ optimizeImages });
  const allExtensions = tiptapExtensions
    ? { ...baseExtensions, ...tiptapExtensions }
    : baseExtensions;
  const extensionValues = Object.values(allExtensions);

  // Build lookup maps: type name → extension config
  const nodeExtMap = new Map<string, any>();
  const markExtMap = new Map<string, any>();
  for (const ext of extensionValues) {
    if (ext.type === 'node') {
      nodeExtMap.set(ext.name, ext);
    }
    else if (ext.type === 'mark') {
      markExtMap.set(ext.name, ext);
    }
  }

  // Wrap renderFn with auto-keying
  const contextRenderFn = (tag: string, attrs: BlockAttributes = {}, children?: T): T => {
    if (keyedResolvers && tag) {
      const currentCount = keyCounters.get(tag) || 0;
      keyCounters.set(tag, currentCount + 1);
      attrs = { ...attrs, key: `${tag}-${currentCount}` };
    }
    return renderFn(tag, attrs, children);
  };

  function renderNode(node: StoryblokRichTextNode<T>): T {
    // Text nodes — apply marks via reduce
    if (node.type === 'text') {
      return renderText(node as TextNode<T>);
    }

    // Document node renders without wrapper
    if (node.type === 'doc') {
      return render(node);
    }

    // Find extension and call renderHTML
    const ext = nodeExtMap.get(node.type);
    if (!ext?.config?.renderHTML) {
      console.error('<Storyblok>', `No extension found for node type ${node.type}`);
      return '' as unknown as T;
    }

    // Check for renderComponent option (e.g., blok nodes configured via tiptapExtensions)
    if (ext.options?.renderComponent) {
      const body = node.attrs?.body;
      const id = node.attrs?.id;
      if (!Array.isArray(body) || body.length === 0) {
        return (isExternalRenderFn ? [] : '') as unknown as T;
      }
      const rendered = body.map((blok: Record<string, unknown>) => ext.options.renderComponent(blok, id));
      return (isExternalRenderFn ? rendered : rendered.filter((r: unknown) => r != null).join('')) as unknown as T;
    }

    // Table: group rows into thead/tbody based on cell types
    if (node.type === 'table' && node.content?.length) {
      const headerRows: StoryblokRichTextNode<T>[] = [];
      const bodyRows: StoryblokRichTextNode<T>[] = [];
      for (const row of node.content) {
        const isHeaderRow = bodyRows.length === 0
          && row.content?.every((cell: StoryblokRichTextNode<T>) => cell.type === 'tableHeader');
        if (isHeaderRow) {
          headerRows.push(row);
        }
        else {
          bodyRows.push(row);
        }
      }
      const nodeAttrs = node.attrs || {};
      const spec = callExtensionRenderHTML(ext, 'node', nodeAttrs);
      const parts: T[] = [];
      if (headerRows.length > 0) {
        parts.push(contextRenderFn('thead', {}, headerRows.map(render) as T));
      }
      if (bodyRows.length > 0) {
        parts.push(contextRenderFn('tbody', {}, bodyRows.map(render) as T));
      }
      return specToRender(spec, contextRenderFn, parts as T | undefined) as T;
    }

    const children = node.content ? node.content.map(render) : undefined;

    const nodeAttrs = node.attrs || {};
    const spec = callExtensionRenderHTML(ext, 'node', nodeAttrs);
    return specToRender(spec, contextRenderFn, children as T | undefined) as T;
  }

  function renderText(node: TextNode<T>): T {
    const { marks, ...rest } = node;

    if (marks?.length) {
      // Base text
      const baseText = (() => {
        const attrs: BlockAttributes = {};
        if (keyedResolvers) {
          const currentCount = keyCounters.get('txt') || 0;
          keyCounters.set('txt', currentCount + 1);
          attrs.key = `txt-${currentCount}`;
        }
        return textFn(rest.text, attrs) as T;
      })();

      // Apply marks as reduce: text → mark1(text) → mark2(mark1(text))
      return marks.reduce((text: T, mark: MarkNode<T>) => {
        const ext = markExtMap.get(mark.type);
        if (!ext?.config?.renderHTML) {
          console.error('<Storyblok>', `No extension found for node type ${mark.type}`);
          return text;
        }

        const markAttrs = mark.attrs || {};
        const spec = callExtensionRenderHTML(ext, 'mark', markAttrs);
        return specToRender(spec, contextRenderFn, text) as T;
      }, baseText);
    }

    // Plain text, no marks
    const attrs: BlockAttributes = node.attrs || {};
    if (keyedResolvers) {
      const currentCount = keyCounters.get('txt') || 0;
      keyCounters.set('txt', currentCount + 1);
      attrs.key = `txt-${currentCount}`;
    }
    return textFn(rest.text, attrs) as T;
  }

  function render(node: StoryblokRichTextNode<T> | StoryblokRichTextDocumentNode): T {
    const n = node as StoryblokRichTextNode<T>;
    if (n.type === 'doc') {
      return isExternalRenderFn ? n.content.map(renderNode) as T : n.content.map(renderNode).join('') as T;
    }
    return Array.isArray(n) ? n.map(renderNode) as T : renderNode(n) as T;
  }

  return {
    render,
  };
}
