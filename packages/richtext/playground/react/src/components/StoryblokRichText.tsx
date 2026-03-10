import { getRichTextSegments, isVoidElement, parseStyleString, renderSegments } from '@storyblok/richtext';
import { createElement, Fragment } from 'react';
import type { RendererAdapter, StoryblokRichTextNode, StoryblokSegmentType } from '@storyblok/richtext';

type StoryblokComponentMap = Partial<Record<StoryblokSegmentType, React.ComponentType<any>>>;
interface StoryblokRichTextProps {
  doc: StoryblokRichTextNode;
  components?: StoryblokComponentMap;
}

export default function StoryblokRichText({ doc, components }: StoryblokRichTextProps) {
  const segments = getRichTextSegments(doc);
  const adapter = createReactAdapter(components);
  const keys = Object.keys(components || {}) as StoryblokSegmentType[];

  const content = renderSegments(segments, adapter, keys);

  return (
    <Fragment>
      {content}
    </Fragment>
  );
}
export function createReactAdapter(
  components?: StoryblokComponentMap,
): RendererAdapter<React.ReactNode> {
  return {
    createElement(tag, attrs = {}, children = []) {
      const isVoid = isVoidElement(tag);

      const { class: className, style, ...rest } = attrs;

      const parsedStyle
        = typeof style === 'string' ? toReactStyle(parseStyleString(style)) : style;
      const normalizedAttrs = normalizeDOMProps(rest);
      return createElement(
        tag,
        { className, style: parsedStyle, ...normalizedAttrs },
        isVoid ? null : children,
      );
    },

    createText(text) {
      return text;
    },

    createComponent(type, props) {
      if (!components) {
        console.warn(`No component mapping provided for "${type}"`);
        return null;
      }
      const Component = components?.[type as StoryblokSegmentType];
      if (!Component) {
        console.warn(`Missing component mapping for "${type}"`);
        return null;
      }

      return createElement(Component, props);
    },
  };
}
function toReactStyle(styleObj: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in styleObj) {
    const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = styleObj[key];
  }
  return result;
}
const reactDOMPropsMap: Record<string, string> = {
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  for: 'htmlFor',
};

function normalizeDOMProps(attrs: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const key in attrs) {
    const reactKey = reactDOMPropsMap[key.toLowerCase()] || key;
    result[reactKey] = attrs[key];
  }
  return result;
}
