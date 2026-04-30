import { ComponentBlok, getStoryblokExtensions } from "./extensions";
import type { Attributes, Mark as TiptapMark, Node as TiptapNode } from "@tiptap/core";
import type { BlockAttributes, MarkNode, StoryblokRichTextNode, TextNode } from "./types";
import { collectMarkedTextGroup, getUniqueMarks, SELF_CLOSING_TAGS } from "./utils";

/**
 * ProseMirror DOMOutputSpec returned by renderHTML
 */
type DOMOutputSpec = (string | number | Attributes | DOMOutputSpec)[];

/**
 * Segment Types
 */

export interface TextSegment {
  kind: "text";
  text: string;
}

export interface NodeSegment {
  kind: "node";
  type: string;
  tag: string | null;
  attrs: Attributes;
  content: SBRichTextSegment[];
}

export interface MarkSegment {
  kind: "mark";
  type: string;
  tag: string | null;
  attrs: Attributes;
  content: SBRichTextSegment[];
}
interface ComponentSegment {
  kind: "component";
  type: string;
  props: Record<string, unknown>;
}
export type SBRichTextSegment = TextSegment | NodeSegment | MarkSegment | ComponentSegment;

export type StoryblokExtensions = ReturnType<typeof getStoryblokExtensions>;
export type StoryblokSegmentType = keyof StoryblokExtensions; // e.g., "paragraph" | "heading" | "image" | ...
/**
 * Renderer Options
 */
export interface StoryblokRichTextOptionsNew {
  optimizeImages?: boolean;

  /**
   * Called when a node has no extension renderer
   */
  onUnknownNode?: (node: StoryblokRichTextNode) => SBRichTextSegment[];

  /**
   * Called when a mark has no extension renderer
   */
  onUnknownMark?: (mark: any) => SBRichTextSegment[];
}
export function getRichTextSegments(
  richText: StoryblokRichTextNode,
  options: StoryblokRichTextOptionsNew = {},
) {
  const blokExtension = {
    blok: ComponentBlok.configure({
      renderComponent: (blok) => blok,
    }),
  };
  const extensions = Object.values({
    ...getStoryblokExtensions({ optimizeImages: options.optimizeImages }),
    ...blokExtension,
  });
  // Build lookup maps: type name → extension config
  const nodeExtMap = new Map<string, TiptapNode>();
  const markExtMap = new Map<string, TiptapMark>();
  for (const ext of extensions) {
    if (ext.type === "node") {
      nodeExtMap.set(ext.name, ext as TiptapNode);
    }
    if (ext.type === "mark") {
      markExtMap.set(ext.name, ext as TiptapMark);
    }
  }

  // --- Mark merging (ProseMirror-style adjacent text node grouping) ---

  /** Renders a group of text nodes with shared marks wrapped once around unique-mark content. */
  function renderMergedTextNodes(
    group: TextNode<string>[],
    shared: MarkNode<string>[],
  ): SBRichTextSegment[] {
    const innerSegments: SBRichTextSegment[] = group.flatMap((node) => {
      return renderText({
        ...node,
        marks: getUniqueMarks(node.marks || [], shared),
      } as TextNode<string>);
    });

    // Reverse: matches renderText's [...marks].reverse() iteration order,
    // where the last mark in the array becomes the outermost segment wrapper.
    let segments: SBRichTextSegment[] = innerSegments;
    for (let i = shared.length - 1; i >= 0; i--) {
      const mark = shared[i];
      const ext = markExtMap.get(mark.type);
      if (!ext?.config?.renderHTML) {
        continue;
      }
      const attrs = mark.attrs ?? {};
      const spec = callExtensionRenderHTML(ext, attrs);
      const tag = getTagFromSpec(spec);
      segments = [
        {
          kind: "mark" as const,
          type: mark.type,
          tag,
          attrs,
          content: segments,
        },
      ];
    }

    return segments;
  }

  /** Groups adjacent text nodes with shared marks and renders them merged. */
  function groupAndFlatMapChildren(children: StoryblokRichTextNode[]): SBRichTextSegment[] {
    const result: SBRichTextSegment[] = [];
    let i = 0;
    while (i < children.length) {
      const match = collectMarkedTextGroup<string>(children, i);
      if (!match) {
        result.push(...renderNode(children[i]));
        i++;
        continue;
      }
      if (match.group.length === 1) {
        result.push(...renderText(match.group[0]));
      } else {
        result.push(...renderMergedTextNodes(match.group, match.shared));
      }
      i = match.endIndex;
    }
    return result;
  }

  // --- End mark merging helpers ---

  function renderNode(node: StoryblokRichTextNode): SBRichTextSegment[] {
    if (node.type === "text") {
      return renderText(node as TextNode<string>);
    }
    if (node.type === "doc") {
      return node.content?.flatMap(renderNode) ?? [];
    }

    const children = node.content ? groupAndFlatMapChildren(node.content) : [];
    const ext = nodeExtMap.get(node.type);

    if (!ext?.config?.renderHTML) {
      return options.onUnknownNode?.(node) ?? children;
    }
    const component = tryRenderComponent(ext, node.attrs || {}, node.type);

    if (component) {
      return [component];
    }
    const attrs = node.attrs || {};

    const spec = callExtensionRenderHTML(ext, attrs);
    const segment = parseDOMSpec(spec, node.type, children);

    return [segment];
  }

  /**
   * Render text nodes + marks
   */
  function renderText(node: TextNode<string>): SBRichTextSegment[] {
    let segments: SBRichTextSegment[] = [
      {
        kind: "text",
        text: node.text,
      },
    ];

    if (!node.marks?.length) {
      return segments;
    }

    /**
     * reverse to maintain correct nesting order
     */
    for (const mark of [...node.marks].reverse()) {
      const ext = markExtMap.get(mark.type);

      if (!ext?.config?.renderHTML) {
        segments = options.onUnknownMark?.(mark) ?? segments;
        continue;
      }

      const attrs = mark.attrs ?? {};

      const spec = callExtensionRenderHTML(ext, attrs);
      const tag = getTagFromSpec(spec);

      segments = segments.map((seg) => ({
        kind: "mark",
        type: mark.type,
        tag,
        attrs,
        content: [seg],
      }));
    }

    return segments;
  }
  return renderNode(richText);
}
/**
 * Call renderHTML safely
 */
function callExtensionRenderHTML(ext: TiptapNode | TiptapMark, attrs: Attributes): DOMOutputSpec {
  const render = ext.config.renderHTML;

  if (!render) {
    throw new Error(`Extension "${ext.name}" does not define renderHTML`);
  }
  const ctx = {
    name: ext.name,
    options: ext.options ?? {},
    parent: null,
  };

  if (ext.type === "node") {
    return (render as any).call(ctx, {
      node: { attrs },
      HTMLAttributes: attrs,
    }) as DOMOutputSpec;
  }

  return (render as any).call(ctx, {
    mark: { attrs },
    HTMLAttributes: attrs,
  }) as DOMOutputSpec;
}

/**
 * Extract tag from DOMOutputSpec
 */
function getTagFromSpec(spec: DOMOutputSpec): string | null {
  const first = spec?.[0];
  return typeof first === "string" ? first : null;
}
export function isVoidElement(tag: string) {
  return SELF_CLOSING_TAGS.includes(tag);
}

function tryRenderComponent(
  ext: TiptapNode,
  attrs: BlockAttributes,
  type: string,
): ComponentSegment | null {
  const renderComponent = (ext.options as any)?.renderComponent;

  if (typeof renderComponent !== "function") {
    return null;
  }

  const result = renderComponent(attrs);

  return {
    kind: "component",
    type,
    props: {
      ...result,
    },
  };
}
function parseDOMSpec(
  spec: DOMOutputSpec,
  nodeType: string,
  fallbackChildren: SBRichTextSegment[],
): NodeSegment {
  const [tag, maybeAttrs, ...rest] = spec;

  let attrs: Attributes = {};
  let childrenSpec: any[] = [];

  if (isAttributes(maybeAttrs)) {
    attrs = maybeAttrs;
    childrenSpec = rest;
  } else {
    childrenSpec = [maybeAttrs, ...rest];
  }

  let content: SBRichTextSegment[] = [];

  for (const child of childrenSpec) {
    if (child === 0) {
      // Insert node children here
      content.push(...fallbackChildren);
      continue;
    }

    if (Array.isArray(child)) {
      content.push(parseDOMSpec(child, nodeType, fallbackChildren));
      continue;
    }

    if (typeof child === "string") {
      content.push({
        kind: "text",
        text: child,
      });
    }
  }
  // --- TABLE FIX ---
  if (tag === "table") {
    const headerRows: NodeSegment[] = [];
    const bodyRows: NodeSegment[] = [];

    for (const row of content as NodeSegment[]) {
      if (row.tag === "tr" && row.content.every((cell) => (cell as NodeSegment).tag === "th")) {
        headerRows.push(row);
      } else {
        bodyRows.push(row as NodeSegment);
      }
    }

    content = [];

    if (headerRows.length) {
      content.push({
        kind: "node",
        type: "thead",
        tag: "thead",
        attrs: {},
        content: headerRows,
      });
    }

    if (bodyRows.length) {
      content.push({
        kind: "node",
        type: "tbody",
        tag: "tbody",
        attrs: {},
        content: bodyRows,
      });
    }
  }
  return {
    kind: "node",
    type: nodeType,
    tag: typeof tag === "string" ? tag : null,
    attrs,
    content,
  };
}
function isAttributes(value: unknown): value is Attributes {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses an inline CSS style string into an object.
 *
 * Example:
 *   parseStyleString("width: 1.25em; height: 1.25em; vertical-align: text-top")
 *   -> { width: "1.25em", height: "1.25em", "vertical-align": "text-top" }
 */
export function parseStyleString(style: string): Record<string, string> {
  const result: Record<string, string> = {};

  if (!style) {
    return {
      ...result,
    };
  }

  // Split by semicolon and remove empty entries
  style.split(";").forEach((rule) => {
    const [prop, value] = rule.split(":");

    if (!prop || !value) {
      return;
    }

    result[prop.trim()] = value.trim();
  });

  return result;
}
