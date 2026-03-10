import { isVoidElement, type RendererAdapter, type StoryblokSegmentType } from '@storyblok/richtext';

export type StoryblokComponentMap = Partial<Record<StoryblokSegmentType, any>>;
export type AstroRenderNode =
  | string
  | {
    tag: string;
    attrs?: Record<string, unknown>;
    children?: AstroRenderNode[];
  }
  | {
    component: StoryblokSegmentType;
    props: Record<string, unknown>;
    children?: AstroRenderNode[];
  };
export function createAstroAdapter(): RendererAdapter<AstroRenderNode> {
  return {
    createElement(tag, attrs = {}, children = []) {
      const { key, ...rest } = attrs;

      return {
        tag,
        attrs: rest,
        children,
      };
    },

    createText(text) {
      return text;
    },

    createComponent(type, props) {
      const { children = [], ...rest } = props;

      return {
        component: type,
        props: rest,
        children: Array.isArray(children) ? (children as AstroRenderNode[]) : undefined,
      };
    },

  };
}
export function createHtmlAdapter(): RendererAdapter<string> {
  return {
    createElement(tag, attrs = {}, children = []) {
      const isVoid = isVoidElement(tag);

      const attrString = Object.entries(attrs)
        .filter(([_, value]) => value !== null && value !== undefined)
        .join(' ');

      const openTag = attrString ? `<${tag} ${attrString}>` : `<${tag}>`;

      if (isVoid) {
        return openTag.replace('>', ' />');
      }

      const childrenString = children.join('');

      return `${openTag}${childrenString}</${tag}>`;
    },

    createText(text) {
      return text;
    },

    createComponent(type) {
      console.warn(`Components are not supported in HTML renderer: ${type}`);
      return '';
    },
  };
}
