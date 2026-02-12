import { Node } from '@tiptap/core';
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Blockquote from '@tiptap/extension-blockquote';
import CodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import Emoji from '@tiptap/extension-emoji';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { optimizeImage } from '../images-optimization';
import type { StoryblokRichTextImageOptimizationOptions } from '../types';
import { cleanObject } from '../utils';
import { computeTableCellAttrs, processBlockAttrs } from './utils';

// Re-export unmodified extensions
export { Details, DetailsContent, DetailsSummary, Document, Text };

// Blockquote, Paragraph, Heading need processBlockAttrs for textAlign support
export const StoryblokBlockquote = Blockquote.extend({
  renderHTML({ HTMLAttributes }) {
    return ['blockquote', processBlockAttrs(HTMLAttributes), 0];
  },
});

export const StoryblokParagraph = Paragraph.extend({
  renderHTML({ HTMLAttributes }) {
    return ['p', processBlockAttrs(HTMLAttributes), 0];
  },
});

export const StoryblokHeading = Heading.extend({
  renderHTML({ node, HTMLAttributes }) {
    const { level, ...rest } = HTMLAttributes;
    return [`h${node.attrs.level}`, processBlockAttrs(rest), 0];
  },
});

export const StoryblokTableRow = TableRow.extend({
  renderHTML({ HTMLAttributes }) {
    return ['tr', processBlockAttrs(HTMLAttributes), 0];
  },
});

// Storyblok uses snake_case names for some extensions
export const StoryblokBulletList = BulletList.extend({
  name: 'bullet_list',
  addOptions() {
    return { ...this.parent!(), itemTypeName: 'list_item' };
  },
  renderHTML({ HTMLAttributes }) {
    return ['ul', processBlockAttrs(HTMLAttributes), 0];
  },
});

export const StoryblokOrderedList = OrderedList.extend({
  name: 'ordered_list',
  addOptions() {
    return { ...this.parent!(), itemTypeName: 'list_item' };
  },
  renderHTML({ HTMLAttributes }) {
    return ['ol', processBlockAttrs(HTMLAttributes), 0];
  },
});

export const StoryblokListItem = ListItem.extend({
  name: 'list_item',
  addOptions() {
    return { ...this.parent!(), bulletListTypeName: 'bullet_list', orderedListTypeName: 'ordered_list' };
  },
  renderHTML({ HTMLAttributes }) {
    return ['li', processBlockAttrs(HTMLAttributes), 0];
  },
});

export const StoryblokCodeBlock = CodeBlock.extend({
  name: 'code_block',
  renderHTML({ node, HTMLAttributes }) {
    const attrs = processBlockAttrs(HTMLAttributes);
    const language = node.attrs.language;
    const codeAttrs = language ? { class: `language-${language}` } : {};
    return ['pre', attrs, ['code', codeAttrs, 0]];
  },
});
export const StoryblokHardBreak = HardBreak.extend({ name: 'hard_break' });
export const StoryblokHorizontalRule = HorizontalRule.extend({ name: 'horizontal_rule' });

// Table with custom renderHTML (wraps in tbody)
export const StoryblokTable = Table.extend({
  renderHTML({ HTMLAttributes }) {
    const attrs = processBlockAttrs(HTMLAttributes);
    return ['table', attrs, ['tbody', {}, 0]];
  },
});

// Table cell with custom style handling
export const StoryblokTableCell = TableCell.extend({
  renderHTML({ HTMLAttributes }) {
    return ['td', computeTableCellAttrs(HTMLAttributes), 0];
  },
});

// Table header with custom style handling
export const StoryblokTableHeader = TableHeader.extend({
  renderHTML({ HTMLAttributes }) {
    return ['th', computeTableCellAttrs(HTMLAttributes), 0];
  },
});

// Image with optimizeImages support
export const StoryblokImage = Image.extend<{ optimizeImages: boolean | Partial<StoryblokRichTextImageOptimizationOptions> }>({
  addOptions() {
    return { ...this.parent?.(), optimizeImages: false };
  },
  renderHTML({ HTMLAttributes }) {
    const { src, alt, title, srcset, sizes } = HTMLAttributes;
    let finalSrc = src;
    let extraAttrs = {};

    if (this.options.optimizeImages) {
      const result = optimizeImage(src, this.options.optimizeImages);
      finalSrc = result.src;
      extraAttrs = result.attrs;
    }

    return ['img', cleanObject({ src: finalSrc, alt, title, srcset, sizes, ...extraAttrs })];
  },
});

// Emoji with custom renderHTML
export const StoryblokEmoji = Emoji.extend({
  renderHTML({ HTMLAttributes }) {
    return ['span', {
      'data-type': 'emoji',
      'data-name': HTMLAttributes.name,
      'data-emoji': HTMLAttributes.emoji,
    }, ['img', {
      src: HTMLAttributes.fallbackImage,
      alt: HTMLAttributes.alt,
      style: 'width: 1.25em; height: 1.25em; vertical-align: text-top',
      draggable: 'false',
      loading: 'lazy',
    }]];
  },
});

// Blok node (component placeholder for vanilla usage)
export const StoryblokBlok = Node.create({
  name: 'blok',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      body: { default: [] },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-blok]' }];
  },
  renderHTML({ HTMLAttributes }) {
    console.warn('[StoryblokRichText] - BLOK resolver is not available for vanilla usage');
    return ['span', {
      blok: HTMLAttributes?.body?.[0],
      id: HTMLAttributes?.id,
      style: 'display: none',
    }];
  },
});
