import type { RichTextSegment } from '@storyblok/js';
import React from 'react';

/* ----------------------------------
 * Types
 * ---------------------------------- */

type NodeRendererProps = {
  segment: Extract<RichTextSegment, { kind: 'node' }>;
  children?: React.ReactNode;
};

type MarkRendererProps = {
  segment: Extract<RichTextSegment, { kind: 'mark' }>;
  children?: React.ReactNode;
};

type RichTextRendererProps = {
  segments: RichTextSegment[];
  components?: {
    node?: Record<string, React.FC<NodeRendererProps>>;
    mark?: Record<string, React.FC<MarkRendererProps>>;
  };
};

/* ----------------------------------
 * Constants
 * ---------------------------------- */

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/* ----------------------------------
 * Helpers
 * ---------------------------------- */

/** Mark-only styles (styled / textStyle) */
function getMarkProps(
  segment: Extract<RichTextSegment, { kind: 'mark' }>
) {
  if (
    segment.markType === 'styled' ||
    segment.markType === 'textStyle'
  ) {
    const { class: className, id, ...style } = segment.attrs || {};
    return { className, id, style };
  }
  return {};
}

/** Node attributes (img, a, video, etc.) */
function getNodeProps(
  segment: Extract<RichTextSegment, { kind: 'node' }>
) {
  if (!segment.attrs) return {};

  const {
    class: className,
    style,
    ...rest
  } = segment.attrs;

  return {
    className,
    style,
    ...rest,
  };
}

/* ----------------------------------
 * Renderer
 * ---------------------------------- */

export function RichTextRenderer({
  segments,
  components,
}: RichTextRendererProps) {
  const renderSegment = (
    segment: RichTextSegment,
    key: React.Key
  ): React.ReactNode => {
    switch (segment.kind) {
      case 'text':
        return <React.Fragment key={key}>{segment.text}</React.Fragment>;

      case 'mark': {
        const children = segment.content.map((child, i) =>
          renderSegment(child, `${key}-m-${i}`)
        );

        const Component = components?.mark?.[segment.markType];
        if (Component) {
          return (
            <Component key={key} segment={segment}>
              {children}
            </Component>
          );
        }

        if ('tag' in segment && segment.tag) {
          const props = getMarkProps(segment);
          return React.createElement(
            segment.tag,
            { key, ...props },
            children
          );
        }

        return <React.Fragment key={key}>{children}</React.Fragment>;
      }

      case 'node': {
        const children = segment.content.map((child, i) =>
          renderSegment(child, `${key}-n-${i}`)
        );

        const Component = components?.node?.[segment.nodeType];
        if (Component) {
          return (
            <Component key={key} segment={segment}>
              {children}
            </Component>
          );
        }

        if ('tag' in segment && segment.tag) {
          const isVoid = VOID_TAGS.has(segment.tag);
          const props = getNodeProps(segment);

          return React.createElement(
            segment.tag,
            { key, ...props },
            isVoid ? undefined : children
          );
        }

        return <React.Fragment key={key}>{children}</React.Fragment>;
      }

      default:
        return null;
    }
  };

  return (
    <>
      {segments.map((segment, i) =>
        renderSegment(
          segment,
          `rt-${i}-${segment.kind}-${segment?.tag ?? ''}`
        )
      )}
    </>
  );
}
