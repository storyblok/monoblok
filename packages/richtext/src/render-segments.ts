import type { SBRichTextSegment, StoryblokSegmentType } from "./richtext-segment";

export interface RendererAdapter<T = unknown> {
  createElement: (tag: string, attrs?: Record<string, unknown>, children?: T[]) => T;

  createText: (text: string) => T;

  createComponent?: (type: StoryblokSegmentType, props: Record<string, unknown>) => T;
}

function renderSegment<T>(
  segment: SBRichTextSegment,
  adapter: RendererAdapter<T>,
  customComponents: StoryblokSegmentType[],
  key?: number,
): T {
  if (segment.kind === "text") {
    return adapter.createText(segment.text);
  }
  // Treat as component if it's a real component or a custom mapped type
  if (segment.kind === "component") {
    if (!adapter.createComponent) {
      throw new Error("Component renderer not provided");
    }
    return adapter.createComponent(segment.type as StoryblokSegmentType, { key, ...segment.props });
  }
  // Node or Mark segment overrides
  if (customComponents.includes(segment.type as StoryblokSegmentType)) {
    if (!adapter.createComponent) {
      throw new Error("Component renderer not provided");
    }

    // Convert NodeSegment or MarkSegment to props
    const props = {
      ...("attrs" in segment ? segment.attrs : {}),
      key,
      children: segment.content?.map((child, i) =>
        renderSegment(child, adapter, customComponents, i),
      ),
    };

    return adapter.createComponent(segment.type as StoryblokSegmentType, props);
  }
  // node or mark
  const children =
    segment.content?.map((child, i) => renderSegment(child, adapter, customComponents, i)) ?? [];

  if (!segment.tag) {
    throw new Error(`Missing tag for ${segment.type}`);
  }

  return adapter.createElement(segment.tag, { ...segment.attrs, key }, children);
}
export function renderSegments<T>(
  segments: SBRichTextSegment[],
  adapter: RendererAdapter<T>,
  customComponents: StoryblokSegmentType[],
): T[] {
  return segments.map((segment, index) => renderSegment(segment, adapter, customComponents, index));
}
