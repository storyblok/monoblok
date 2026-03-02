import { Mark } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import Highlight from '@tiptap/extension-highlight';
import Italic from '@tiptap/extension-italic';
import LinkOriginal from '@tiptap/extension-link';
import Strike from '@tiptap/extension-strike';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { attrsToStyle, cleanObject } from '../utils';
import { getAllowedStylesForElement, resolveStoryblokLink, supportedAttributesByTagName } from './utils';

// Unmodified mark extensions
export { Bold, Code, Highlight, Italic, Strike, Subscript, Superscript, TextStyleKit, Underline };

// Link with Storyblok-specific attributes and renderHTML
export const StoryblokLink = LinkOriginal.extend({
  addAttributes() {
    return {
      href: {
        parseHTML: (element: HTMLElement) => element.getAttribute('href'),
      },
      uuid: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-uuid') || null,
      },
      anchor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-anchor') || null,
      },
      target: {
        parseHTML: (element: HTMLElement) => element.getAttribute('target') || null,
      },
      linktype: {
        default: 'url',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-linktype') || 'url',
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const { href, rest } = resolveStoryblokLink(HTMLAttributes);
    return ['a', cleanObject({ ...(href ? { href } : {}), ...rest }), 0];
  },
});

// Link with custom attributes support
export const StoryblokLinkWithCustomAttributes = StoryblokLink.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      custom: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const defaultLinkAttributes = supportedAttributesByTagName.a;
          const customAttributeNames = element.getAttributeNames().filter(n => !defaultLinkAttributes.includes(n));
          const customAttributes: Record<string, string | null> = {};
          for (const attributeName of customAttributeNames) {
            customAttributes[attributeName] = element.getAttribute(attributeName);
          }
          return Object.keys(customAttributes).length ? customAttributes : null;
        },
      },
    };
  },
});

// Anchor mark (renders as span with id)
export const StoryblokAnchor = Mark.create({
  name: 'anchor',
  addAttributes() {
    return {
      id: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'span[id]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { id: HTMLAttributes.id }, 0];
  },
});

export interface StyledOptions {
  allowedStyles?: string[];
}

// Styled mark with whitelisted CSS classes
export const StoryblokStyled = Mark.create<StyledOptions>({
  name: 'styled',
  addAttributes() {
    return {
      class: {
        parseHTML: (element: HTMLElement) => {
          const styles = getAllowedStylesForElement(element, { allowedStyles: this.options.allowedStyles || [] });
          return styles.length ? styles.join(' ') : null;
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span',
        consuming: false,
        getAttrs: (element: HTMLElement) => {
          const styles = getAllowedStylesForElement(element, { allowedStyles: this.options.allowedStyles || [] });
          return styles.length ? null : false;
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { class: className, ...rest } = HTMLAttributes;
    return ['span', cleanObject({ class: className, style: attrsToStyle(rest) || undefined }), 0];
  },
});

// TextStyle mark
export const StoryblokTextStyle = Mark.create({
  name: 'textStyle',
  addAttributes() {
    return {
      class: { default: null },
      id: { default: null },
      color: { default: null },
    };
  },
  parseHTML() {
    return [{
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
    }];
  },
  renderHTML({ HTMLAttributes }) {
    const { class: className, id: idName, ...styleAttrs } = HTMLAttributes;
    return ['span', cleanObject({
      class: className,
      id: idName,
      style: attrsToStyle(styleAttrs) || undefined,
    }), 0];
  },
});

// Reporter mark: parse-only diagnostic, no renderHTML needed
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

          const unsupportedAttributes = element.getAttributeNames().filter((attr) => {
            const supportedAttrs = tagName in supportedAttributesByTagName ? supportedAttributesByTagName[tagName] : [];
            return !supportedAttrs.includes(attr);
          });
          for (const attr of unsupportedAttributes) {
            console.warn(`[StoryblokRichText] - \`${attr}\` "${element.getAttribute(attr)}" on \`<${tagName}>\` can not be transformed to rich text.`);
          }

          return false;
        },
      },
    ];
  },
});
