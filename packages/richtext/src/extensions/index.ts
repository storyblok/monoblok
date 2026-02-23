import type { Extension, Mark, Node } from '@tiptap/core';
import type { StoryblokRichTextImageOptimizationOptions } from '../types';
import {
  ComponentBlok,
  Details,
  DetailsContent,
  DetailsSummary,
  Document,
  StoryblokBlockquote,
  StoryblokBulletList,
  StoryblokCodeBlock,
  StoryblokEmoji,
  StoryblokHardBreak,
  StoryblokHeading,
  StoryblokHorizontalRule,
  StoryblokImage,
  StoryblokListItem,
  StoryblokOrderedList,
  StoryblokParagraph,
  StoryblokTable,
  StoryblokTableCell,
  StoryblokTableHeader,
  StoryblokTableRow,
  Text,
} from './nodes';
import {
  Bold,
  Code,
  Highlight,
  Italic,
  Reporter,
  StoryblokAnchor,
  StoryblokLink,
  StoryblokLinkWithCustomAttributes,
  StoryblokStyled,
  Strike,
  Subscript,
  Superscript,
  TextStyleKit,
  Underline,
} from './marks';

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

export interface StoryblokExtensionOptions {
  optimizeImages?: boolean | Partial<StoryblokRichTextImageOptimizationOptions>;
  allowCustomAttributes?: boolean;
  styleOptions?: StyleOption[];
}

const defaultExtensions = {
  document: Document,
  text: Text,
  paragraph: StoryblokParagraph,
  blockquote: StoryblokBlockquote,
  heading: StoryblokHeading,
  bulletList: StoryblokBulletList,
  orderedList: StoryblokOrderedList,
  listItem: StoryblokListItem,
  codeBlock: StoryblokCodeBlock,
  hardBreak: StoryblokHardBreak,
  horizontalRule: StoryblokHorizontalRule,
  image: StoryblokImage,
  emoji: StoryblokEmoji,
  table: StoryblokTable,
  tableRow: StoryblokTableRow,
  tableCell: StoryblokTableCell,
  tableHeader: StoryblokTableHeader,
  blok: ComponentBlok,
  details: Details,
  detailsContent: DetailsContent,
  detailsSummary: DetailsSummary,
  bold: Bold,
  italic: Italic,
  strike: Strike,
  underline: Underline,
  code: Code,
  superscript: Superscript,
  subscript: Subscript,
  highlight: Highlight,
  textStyleKit: TextStyleKit,
  link: StoryblokLink as typeof StoryblokLink,
  anchor: StoryblokAnchor,
  styled: StoryblokStyled,
  reporter: Reporter,
};

export { defaultExtensions };

export function getStoryblokExtensions(options: StoryblokExtensionOptions = {}) {
  const Link = options.allowCustomAttributes ? StoryblokLinkWithCustomAttributes : StoryblokLink;

  return {
    ...defaultExtensions,
    image: StoryblokImage.configure({ optimizeImages: options.optimizeImages || false }),
    link: Link,
    styled: StoryblokStyled.configure({ allowedStyles: options.styleOptions?.map(o => o.value) }),
    reporter: Reporter.configure({ allowCustomAttributes: options.allowCustomAttributes }),
  };
}

export * from './marks';
export * from './nodes';
export { computeTableCellAttrs, processBlockAttrs, resolveStoryblokLink } from './utils';
