import Emoji from '@tiptap/extension-emoji';
import type { CodeBlockAttrs, ExtensionOptions } from './richtext-attrs';
import { Node } from '@tiptap/core';
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Blockquote from '@tiptap/extension-blockquote';
import CodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { mapToAttribute } from './utils';

export { Document, Text };

export function buildEmojiExtension(
  options?: ExtensionOptions<'emoji'>,
) {
  const parser = options?.attributeParsers;

  return Emoji.extend({
    parseHTML: options?.parseHTML ?? (() => {
      return [{ tag: 'img[data-emoji]' }, { tag: 'span[data-emoji]' }];
    }),
    addAttributes() {
      return {
        fallbackImage: {
          default: null,
          parseHTML: parser?.fallbackImage ?? mapToAttribute(['src', 'data-src']),
        },
        name: {
          default: null,
          parseHTML: parser?.name ?? mapToAttribute('data-name'),
        },
        emoji: {
          default: null,
          parseHTML: parser?.emoji ?? mapToAttribute('data-emoji'),
        },
      };
    },
    renderHTML({ HTMLAttributes }) {
      return ['span', {
        'data-emoji': HTMLAttributes.emoji,
        'data-name': HTMLAttributes.name,
      }, HTMLAttributes.emoji];
    },
  });
}

export function buildBlockquoteExtension() {
  return Blockquote.extend({
    renderHTML({ HTMLAttributes }) {
      return ['blockquote', { ...HTMLAttributes }, 0];
    },
  });
}

export function buildParagraphExtension(options?: ExtensionOptions<'paragraph'>) {
  const parser = options?.attributeParsers;
  return Paragraph.extend({
    addAttributes() {
      return {
        textAlign: {
          default: null,
          parseHTML: parser?.textAlign || mapToAttribute(undefined, 'text-align'),
        },
      };
    },
  });
}

export function buildHeadingExtension(options?: ExtensionOptions<'heading'>) {
  const parser = options?.attributeParsers;
  return Heading.extend({
    addAttributes() {
      return {
        level: {
          default: 1,
          parseHTML: parser?.level,
        },
        textAlign: {
          default: null,
          parseHTML: parser?.textAlign || mapToAttribute(undefined, 'text-align'),
        },
      };
    },
  });
}

export function buildTableRowExtension() {
  return TableRow.extend({
    renderHTML({ HTMLAttributes }) {
      return ['tr', { ...HTMLAttributes }, 0];
    },
  });
}

export function buildBulletListExtension() {
  return BulletList.extend({
    name: 'bullet_list',
    addOptions() {
      return { ...this.parent!(), itemTypeName: 'list_item' };
    },
  });
}

export function buildOrderedListExtension(options?: ExtensionOptions<'ordered_list'>) {
  const parser = options?.attributeParsers;
  return OrderedList.extend({
    name: 'ordered_list',
    addAttributes() {
      return {
        order: {
          default: 1,
          parseHTML: parser?.order || ((el) => {
            const value = el.getAttribute('start') || el.getAttribute('data-order');
            if (value) {
              const num = Number(value);
              if (!Number.isNaN(num)) {
                return num;
              }
            }
            return 1;
          }),
        },
      };
    },
    addOptions() {
      return { ...this.parent!(), itemTypeName: 'list_item' };
    },
  });
}

export function buildListItemExtension() {
  return ListItem.extend({
    name: 'list_item',
    addOptions() {
      return {
        ...this.parent!(),
        bulletListTypeName: 'bullet_list',
        orderedListTypeName: 'ordered_list',
      };
    },
  });
}

export function buildCodeBlockExtension(options?: ExtensionOptions<'code_block'>) {
  const parser = options?.attributeParsers;
  return CodeBlock.extend({
    name: 'code_block',
    addAttributes() {
      return {
        class: {
          default: null,
          parseHTML: parser?.class || ((el) => {
            const code = el.querySelector('code');

            // Priority 1: code element
            if (code) {
              return (
                code.getAttribute('data-language')
                || code.getAttribute('class')
              );
            }

            // Priority 2: pre element
            return (
              el.getAttribute('data-language')
              || el.getAttribute('class')
            );
          }),
        },
      };
    },
    renderHTML({ HTMLAttributes }) {
      const attrs = HTMLAttributes as CodeBlockAttrs;

      return ['pre', ['code', { class: attrs.class }, 0]];
    },
  });
}

export function buildHardBreakExtension() {
  return HardBreak.extend({
    name: 'hard_break',
  });
}

export function buildHorizontalRuleExtension() {
  return HorizontalRule.extend({
    name: 'horizontal_rule',
  });
}

export function buildTableExtension() {
  return Table.extend({
    renderHTML({ HTMLAttributes }) {
      return ['table', { ...HTMLAttributes }, 0];
    },
  });
}

const parseTableWidth = (element: HTMLElement): number[] | null => {
  // 1️⃣ colwidth attribute
  const colwidth = element.getAttribute('colwidth');

  if (colwidth) {
    const values = colwidth
      .split(',')
      .map(v => Number(v.trim()))
      .filter(v => !Number.isNaN(v));

    return values.length ? values : null;
  }

  // 2️⃣ inline style width
  const styleWidth = element.style?.width;

  if (styleWidth) {
    const numeric = Number.parseFloat(styleWidth); // handles "100px"
    if (!Number.isNaN(numeric)) {
      return [numeric];
    }
  }

  return null;
};

export function buildTableCellExtension(options?: ExtensionOptions<'tableCell'>) {
  const parser = options?.attributeParsers;

  return TableCell.extend({
    addAttributes() {
      return {
        colspan: { default: 1, parseHTML: parser?.colspan },
        rowspan: { default: 1, parseHTML: parser?.rowspan },
        colwidth: {
          default: null,
          parseHTML: parser?.colwidth ?? parseTableWidth,
        },
        backgroundColor: {
          default: null,
          parseHTML: parser?.backgroundColor ?? mapToAttribute(undefined, 'background-color'),
        },
      };
    },
  });
}

export function buildTableHeaderExtension(options?: ExtensionOptions<'tableHeader'>) {
  const parser = options?.attributeParsers;

  return TableHeader.extend({
    addAttributes() {
      return {
        colspan: { default: 1, parseHTML: parser?.colspan },
        rowspan: { default: 1, parseHTML: parser?.rowspan },
        colwidth: {
          default: null,
          parseHTML: parser?.colwidth ?? parseTableWidth,
        },
      };
    },
  });
}

export function buildImageExtension(
  options?: ExtensionOptions<'image'>,
) {
  const parser = options?.attributeParsers;
  return Image.extend({
    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: parser?.id,
        },
        src: {
          default: null,
          parseHTML: parser?.src,
        },
        alt: {
          default: null,
          parseHTML: parser?.alt,
        },
        title: {
          default: null,
          parseHTML: parser?.title,
        },
        source: {
          default: null,
          parseHTML: parser?.source,
        },
        copyright: {
          default: null,
          parseHTML: parser?.copyright,
        },
        meta_data: {
          default: null,
          parseHTML: parser?.meta_data,
        },
      };
    },
  });
}

export function buildComponentBlokExtension(
  options?: ExtensionOptions<'blok'>,
) {
  const parser = options?.attributeParsers;

  return Node.create({
    name: 'blok',
    group: 'block',
    atom: true,
    addAttributes() {
      return {
        id: { default: null, parseHTML: parser?.id },
        body: { default: [], parseHTML: parser?.body,
        },
      };
    },
    parseHTML: options?.parseHTML ?? (() => {
      return [{ tag: 'div[data-blok]' }];
    }),
  });
}
