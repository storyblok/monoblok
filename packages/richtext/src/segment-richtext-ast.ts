import { getStoryblokExtensions } from './extensions';
import type {
  BlockAttributes,
  StoryblokRichTextDocumentNode,
  StoryblokRichTextNode,
  StoryblokRichTextOptions,
  TextNode,
} from './types';

/* ------------------------------------------------------------------ */
/* Segment types */
/* ------------------------------------------------------------------ */
interface TextSegment {
  kind: 'text';
  text: string;
}

interface NodeSegment {
  kind: 'node';
  nodeType: string;
  tag: string | null;
  attrs: Record<string, any>;
  content: RichTextSegment[];
}
interface MarkSegment {
  kind: 'mark';
  markType: string;
  tag: string | null;
  attrs: Record<string, any>;
  content: RichTextSegment[];
}
export type RichTextSegment =
  | TextSegment
  | NodeSegment
  | MarkSegment;
export type RenderFn<T = string> = (
  tag: string,
  attrs?: BlockAttributes,
  children?: T,
) => T;
/* ------------------------------------------------------------------ */
/* Helpers copied from original resolver */
/* ------------------------------------------------------------------ */

function callExtensionRenderHTML(
  ext: any,
  type: 'node' | 'mark',
  attrs: Record<string, any>,
): any[] {
  const ctx = { options: ext.options || {}, name: ext.name, type: ext.type };
  if (type === 'node') {
    return ext.config.renderHTML.call(ctx, {
      node: { attrs },
      HTMLAttributes: attrs,
    });
  }
  return ext.config.renderHTML.call(ctx, {
    mark: { attrs },
    HTMLAttributes: attrs,
  });
}

/* ------------------------------------------------------------------ */
/* Segment resolver */
/* ------------------------------------------------------------------ */

function getTagFromSpec(spec: any[]): string | null {
  return typeof spec[0] === 'string' ? spec[0] : null;
}
export function richTextSegmentResolver(
  options: StoryblokRichTextOptions<string> & {
    segments?: string[];
  } = {},
) {
  const {
    optimizeImages = false,
    tiptapExtensions,
  } = options;

  const baseExtensions = getStoryblokExtensions({ optimizeImages });
  const allExtensions = tiptapExtensions
    ? { ...baseExtensions, ...tiptapExtensions }
    : baseExtensions;

  const nodeExtMap = new Map<string, any>();
  const markExtMap = new Map<string, any>();

  for (const ext of Object.values(allExtensions)) {
    if (ext.type === 'node') {
      nodeExtMap.set(ext.name, ext);
    }
    if (ext.type === 'mark') {
      markExtMap.set(ext.name, ext);
    }
  }

  /* ------------------------------------------------------------ */
  /* Node rendering */
  /* ------------------------------------------------------------ */

  function renderNode(
    node: StoryblokRichTextNode<string>,
  ): RichTextSegment[] {
    if (node.type === 'text') {
      return renderText(node as TextNode<string>);
    }

    if (node.type === 'doc') {
      return node.content.flatMap(renderNode);
    }

    const children = node.content
      ? node.content.flatMap(renderNode)
      : [];

    const ext = nodeExtMap.get(node.type);

    if (!ext?.config?.renderHTML) {
      return [];
    }

    const spec = callExtensionRenderHTML(ext, 'node', node.attrs || {});
    const tag = getTagFromSpec(spec);

    // Always preserve as a structure node
    return [
      {
        kind: 'node',
        nodeType: node.type,
        tag,
        attrs: node.attrs || {},
        content: children,
      },
    ];
  }

  /* ------------------------------------------------------------ */
  /* Text + marks */
  /* ------------------------------------------------------------ */

  function renderText(node: TextNode<string>): RichTextSegment[] {
    let segments: RichTextSegment[] = [
      {
        kind: 'text',
        text: node.text,
      },
    ];

    if (!node.marks?.length) {
      return segments;
    }

    for (const mark of node.marks) {
      const ext = markExtMap.get(mark.type);

      if (!ext?.config?.renderHTML) {
        continue;
      }

      const spec = callExtensionRenderHTML(ext, 'mark', mark.attrs || {});
      const tag = getTagFromSpec(spec);

      // Always return as mark structure
      segments = segments.map(seg => ({
        kind: 'mark',
        markType: mark.type,
        tag,
        attrs: mark.attrs || {},
        content: [seg],
      }));
    }

    return segments;
  }

  /* ------------------------------------------------------------ */

  function render(doc: StoryblokRichTextDocumentNode): RichTextSegment[] {
    return renderNode(doc as any);
  }

  return { render };
}
