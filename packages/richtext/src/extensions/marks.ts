import { Mark } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import Highlight from '@tiptap/extension-highlight';
import Italic from '@tiptap/extension-italic';
import LinkOriginal from '@tiptap/extension-link';
import Strike from '@tiptap/extension-strike';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Underline from '@tiptap/extension-underline';

import { mapToAttribute, supportedAttributesByTagName } from './utils';
import type {
  AnchorAttrs,
  ExtensionOptions,
  StyledAttrs,
  TextStyleAttrs,
} from './richtext-attrs';

export { Bold, Code, Italic, Strike, Subscript, Superscript, Underline };

export function buildHighlightExtension(
  options?: ExtensionOptions<'highlight'>,
) {
  const parser = options?.attributeParsers;
  return Highlight.extend({
    addAttributes() {
      return {
        color: {
          default: null,
          parseHTML:
            parser?.color ?? mapToAttribute(undefined, 'background-color'),
        },
      };
    },
  });
}
const parseCustomLinkAttributes = (element: HTMLElement) => {
  const defaultLinkAttributes = supportedAttributesByTagName.a;
  const customAttributeNames = element
    .getAttributeNames()
    .filter(n => !defaultLinkAttributes.includes(n));
  const customAttributes: Record<string, string | null> = {};
  for (const attributeName of customAttributeNames) {
    customAttributes[attributeName] = element.getAttribute(attributeName);
  }
  return Object.keys(customAttributes).length ? customAttributes : null;
};

export function buildLinkExtension(options?: ExtensionOptions<'link'>) {
  const parser = options?.attributeParsers;
  return LinkOriginal.extend({
    addAttributes() {
      return {
        href: {
          parseHTML: parser?.href ?? mapToAttribute('href'),
        },
        uuid: {
          default: null,
          parseHTML: parser?.uuid ?? mapToAttribute('data-uuid'),
        },
        anchor: {
          default: null,
          parseHTML: parser?.anchor ?? mapToAttribute('data-anchor'),
        },
        target: {
          default: null,
          parseHTML: parser?.target ?? mapToAttribute('target'),
        },
        linktype: {
          default: 'url',
          parseHTML: parser?.linktype ?? mapToAttribute('data-linktype'),
        },
        custom: {
          default: {},
          parseHTML: parser?.custom ?? parseCustomLinkAttributes,
        },
      };
    },
  });
}

export function buildAnchorExtension(options?: ExtensionOptions<'anchor'>) {
  const parser = options?.attributeParsers;
  return Mark.create({
    name: 'anchor',
    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: parser?.id ?? mapToAttribute(['id', 'data-id']),
        },
      };
    },
    parseHTML:
      options?.parseHTML
      ?? (() => {
        return [{ tag: 'span[id]' }];
      }),
    renderHTML({ HTMLAttributes }) {
      const { id } = HTMLAttributes as AnchorAttrs;
      return ['span', { id }, 0];
    },
  });
}

export function buildStyledExtension(options?: ExtensionOptions<'textStyle'>) {
  const parser = options?.attributeParsers;
  return Mark.create({
    name: 'styled',
    parseHTML:
      options?.parseHTML
      ?? (() => {
        return [
          {
            tag: 'span',
            consuming: false,
            getAttrs: (element: HTMLElement) => {
              // Only match spans with inline style containing color
              const className = element.getAttribute('class');
              if (className) {
                return null;
              }
              return false;
            },
          },
        ];
      }),
    addAttributes() {
      return {
        class: {
          default: null,
          parseHTML: parser?.class ?? mapToAttribute('class'),
        },
      };
    },
    renderHTML({ HTMLAttributes }) {
      const { class: className } = HTMLAttributes as StyledAttrs;
      return ['span', { class: className }, 0];
    },
  });
}

export function buildTextStyleExtension(
  options?: ExtensionOptions<'textStyle'>,
) {
  const parser = options?.attributeParsers;
  return Mark.create({
    name: 'textStyle',
    parseHTML:
      options?.parseHTML
      ?? (() => {
        return [
          {
            tag: 'span',
            consuming: false,
            getAttrs: (element: HTMLElement) => {
              // Only match spans with inline style containing color
              const style = element.getAttribute('style');
              if (style && /color/i.test(style)) {
                return null;
              }
              return false;
            },
          },
        ];
      }),
    addAttributes() {
      return {
        color: {
          default: null,
          parseHTML: parser?.color ?? mapToAttribute(undefined, 'color'),
        },
      };
    },
    renderHTML({ HTMLAttributes }) {
      const { color } = HTMLAttributes as TextStyleAttrs;
      const styles: string[] = [];
      if (color) {
        styles.push(`color: ${color};`);
      }
      return [
        'span',
        {
          ...(styles.length > 0 ? { style: styles.join(' ') } : {}),
        },
        0,
      ];
    },
  });
}
// Reporter mark: parse-only diagnostic, no renderHTML needed
// TODO: This is vary vague and not fully same we need to improve this, this is not esssential for the first version, we can iterate on this later
export const Reporter = Mark.create({
  name: 'reporter',
  priority: 0,
  addOptions() {
    return {
      allowCustomAttributes: false,
    };
  },
  parseHTML() {
    return [
      {
        tag: '*',
        consuming: false,
        getAttrs: (element: HTMLElement) => {
          const tagName = element.tagName.toLowerCase();
          if (tagName === 'a' && this.options.allowCustomAttributes) {
            return false;
          }

          const unsupportedAttributes = element
            .getAttributeNames()
            .filter((attr) => {
              const supportedAttrs
                = tagName in supportedAttributesByTagName
                  ? supportedAttributesByTagName[tagName]
                  : [];
              return !supportedAttrs.includes(attr);
            });
          for (const attr of unsupportedAttributes) {
            console.warn(
              `[StoryblokRichText] - \`${attr}\` "${element.getAttribute(attr)}" on \`<${tagName}>\` can not be transformed to rich text.`,
            );
          }

          return false;
        },
      },
    ];
  },
});
