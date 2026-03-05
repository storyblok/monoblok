import React from 'react';
import {
  isVoidElement,
  type KnownNodeType,
  parseStyleString,
  type RichTextSegment,
} from '@storyblok/richtext';

interface Props {
  segments: RichTextSegment[];
  components?: Partial<
    Record<KnownNodeType, React.FC<{ segment: RichTextSegment }>>
  >;
}

export function ReactRichText({ segments, components = {} }: Props) {
  const renderSegments = (segments: RichTextSegment[], path: string): React.ReactNode[] =>
    segments.map((segment, i) => {
      const currentPath = `${path}-${i}`;
      const key = createSegmentKey(segment, currentPath);
      return renderSegment(segment, key, currentPath);
    });

  const renderSegment = (
    segment: RichTextSegment,
    key: React.Key,
    path: string,
  ): React.ReactNode => {
    // Check if user provided a custom component for this type
    const userComponentKey
      = segment.kind === 'component'
        ? segment.type
        : segment.type ?? segment.tag ?? undefined;

    if (userComponentKey && components?.[userComponentKey as KnownNodeType]) {
      const Component = components[userComponentKey as KnownNodeType]!;
      return <Component key={key} segment={segment} />;
    }

    switch (segment.kind) {
      case 'text':
        return <React.Fragment key={key}>{segment.text}</React.Fragment>;

      case 'mark':
      case 'node': {
        const Tag = segment.tag ?? 'span';
        const children = renderSegments(segment.content ?? [], path);
        const isSelfClosing = isVoidElement(Tag);

        // Extract style and other attributes
        const { style, class: className, id, color, ...rest } = segment.attrs ?? {};
        const parsedStyle = { ...parseStyleString(style ?? ''), color };

        return React.createElement(
          Tag,
          { key, ...rest, className, id, style: parsedStyle },
          isSelfClosing ? undefined : children,
        );
      }

      case 'component':
        // fallback if kind=component but no user component exists
        return null;

      default:
        return null;
    }
  };

  return <>{renderSegments(segments, '0')}</>;
}

/**
 * Generates a unique key for a segment
 */
function createSegmentKey(segment: RichTextSegment, path: string) {
  const type
    = segment.kind === 'text'
      ? 'text'
      : segment.kind === 'component'
        ? segment.component
        : segment.type ?? segment.tag ?? 'node';
  return `rt-${path}-${segment.kind}-${type}`;
}
