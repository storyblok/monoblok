import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { generateJSON } from '@tiptap/html';
import type { StoryblokRichTextDocumentNode } from './types';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { type Extension, Mark, type Node } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import Emoji from '@tiptap/extension-emoji';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import Highlight from '@tiptap/extension-highlight';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Italic from '@tiptap/extension-italic';
import LinkOriginal from '@tiptap/extension-link';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Text from '@tiptap/extension-text';
import Underline from '@tiptap/extension-underline';

export interface StyleOption {
  name: string;
  value: string;
}

export interface HTMLParserOptions {
  allowCustomAttributes?: boolean;
  preserveWhitespace?: boolean | 'full';
  tiptapExtensions?: Partial<typeof defaultExtensions & Record<string, Extension | Mark | Node>>;
  styleOptions?: StyleOption[];
}

export interface StyledOptions {
  allowedStyles?: string[];
}

const getAllowedStylesForElement = (element: HTMLElement, { allowedStyles }: { allowedStyles: string[] }) => {
  const classString = element.getAttribute('class') || '';
  const classes = classString.split(' ').filter(Boolean);
  if (!classes.length) {
    return [];
  }

  const invalidStyles = classes.filter(x => !allowedStyles.includes(x));
  for (const invalidStyle of invalidStyles) {
    console.warn(`[StoryblokRichText] - \`class\` "${invalidStyle}" on \`<${element.tagName.toLowerCase()}>\` can not be transformed to rich text.`);
  }

  return allowedStyles.filter(x => classes.includes(x));
};

const StoryblokBulletList = BulletList.extend({
  name: 'bullet_list',
  addOptions() {
    return { ...this.parent!(), itemTypeName: 'list_item' };
  },
});
const StoryblokOrderedList = OrderedList.extend({
  name: 'ordered_list',
  addOptions() {
    return { ...this.parent!(), itemTypeName: 'list_item' };
  },
});
const StoryblokListItem = ListItem.extend({
  name: 'list_item',
  addOptions() {
    return { ...this.parent!(), bulletListTypeName: 'bullet_list', orderedListTypeName: 'ordered_list' };
  },
});
const StoryblokCodeBlock = CodeBlock.extend({ name: 'code_block' });
const StoryblokHardBreak = HardBreak.extend({ name: 'hard_break' });
const StoryblokHorizontalRule = HorizontalRule.extend({ name: 'horizontal_rule' });

const LinkDefault = LinkOriginal.extend({
  addAttributes() {
    return {
      href: {
        parseHTML: element => element.getAttribute('href'),
      },
      uuid: {
        default: null,
        parseHTML: element => element.getAttribute('data-uuid') || null,
      },
      anchor: {
        default: null,
        parseHTML: element => element.getAttribute('data-anchor') || null,
      },
      target: {
        parseHTML: element => element.getAttribute('target') || null,
      },
      linktype: {
        default: 'url',
        parseHTML: element => element.getAttribute('data-linktype') || 'url',
      },
    };
  },
});

const supportedAttributesByTagName: Record<string, string[]> = {
  a: ['href', 'target', 'data-uuid', 'data-anchor', 'data-linktype'],
  img: ['alt', 'src', 'title'],
  span: ['class'],
} as const;

const LinkWithCustomAttributes = LinkDefault.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      custom: {
        default: null,
        parseHTML: (element) => {
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

const Styled = Mark.create<StyledOptions>({
  name: 'styled',
  addAttributes() {
    return {
      class: {
        parseHTML: (element) => {
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
        getAttrs: (element) => {
          const styles = getAllowedStylesForElement(element, { allowedStyles: this.options.allowedStyles || [] });
          return styles.length ? null : false;
        },
      },
    ];
  },
});

const Reporter = Mark.create({
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
        getAttrs: (element) => {
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

const defaultExtensions = {
  bulletList: StoryblokBulletList,
  listItem: StoryblokListItem,
  orderedList: StoryblokOrderedList,
  details: Details,
  detailsContent: DetailsContent,
  detailsSummary: DetailsSummary,
  table: Table,
  tableCell: TableCell,
  tableHeader: TableHeader,
  tableRow: TableRow,
  blockquote: Blockquote,
  bold: Bold,
  code: Code,
  codeBlock: StoryblokCodeBlock,
  document: Document,
  emoji: Emoji,
  hardBreak: StoryblokHardBreak,
  heading: Heading,
  highlight: Highlight,
  horizontalRule: StoryblokHorizontalRule,
  image: Image,
  italic: Italic,
  link: LinkDefault,
  paragraph: Paragraph,
  reporter: Reporter,
  strike: Strike,
  styled: Styled,
  subscript: Subscript,
  superscript: Superscript,
  text: Text,
  textStyleKit: TextStyleKit,
  underline: Underline,
};

export function htmlToStoryblokRichtext(
  html: string,
  options: HTMLParserOptions = {},
) {
  const Link = options.allowCustomAttributes ? LinkWithCustomAttributes : LinkDefault;
  const allExtensions = {
    ...defaultExtensions,
    link: Link,
    reporter: Reporter.configure({
      allowCustomAttributes: options.allowCustomAttributes,
    }),
    styled: Styled.configure({ allowedStyles: options.styleOptions?.map(o => o.value) }),
    ...options.tiptapExtensions,
  };

  return generateJSON(html, Object.values(allExtensions), {
    preserveWhitespace: options.preserveWhitespace || false,
  }) as StoryblokRichTextDocumentNode;
}
