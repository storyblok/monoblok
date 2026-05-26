import { buildBlockquoteExtension, buildBulletListExtension, buildCodeBlockExtension, buildComponentBlokExtension, buildEmojiExtension, buildHardBreakExtension, buildHeadingExtension, buildHorizontalRuleExtension, buildImageExtension, buildListItemExtension, buildOrderedListExtension, buildParagraphExtension, buildTableCellExtension, buildTableExtension, buildTableHeaderExtension, buildTableRowExtension, Document, Text } from './nodes';
import type { ExtensionKey, ExtensionOptions } from './richtext-attrs';
import { Bold, buildAnchorExtension, buildHighlightExtension, buildLinkExtension, buildStyledExtension, buildTextStyleExtension, Code, Italic, Reporter, Strike, Subscript, Superscript, Underline } from './marks';

export interface StyleOption {
  name: string;
  value: string;
}

export type StoryblokParserOptionsMap = {
  [K in ExtensionKey]?: ExtensionOptions<K>;
};

export interface HTMLParserOptions {
  parsers?: StoryblokParserOptionsMap;
  allowCustomAttributes?: boolean;
  styleOptions?: StyleOption[];
  preserveWhitespace?: boolean;
}

interface GetStoryblokTiptapExtensionsOptions extends HTMLParserOptions {
  enableReporter?: boolean;
}

export function getStoryblokTiptapExtensions(options: GetStoryblokTiptapExtensionsOptions) {
  const parsers = options?.parsers || {};
  const enableReporter = options?.enableReporter || false;
  return {
    document: Document,
    text: Text,
    emoji: buildEmojiExtension(parsers?.emoji),
    paragraph: buildParagraphExtension(parsers?.paragraph),
    blockquote: buildBlockquoteExtension(),
    heading: buildHeadingExtension(parsers?.heading),
    bulletList: buildBulletListExtension(),
    orderedList: buildOrderedListExtension(parsers?.ordered_list),
    listItem: buildListItemExtension(),
    codeBlock: buildCodeBlockExtension(parsers?.code_block),
    hardBreak: buildHardBreakExtension(),
    horizontalRule: buildHorizontalRuleExtension(),
    image: buildImageExtension(parsers?.image),
    table: buildTableExtension(),
    tableRow: buildTableRowExtension(),
    tableCell: buildTableCellExtension(parsers?.tableCell),
    tableHeader: buildTableHeaderExtension(parsers?.tableHeader),
    blok: buildComponentBlokExtension(parsers?.blok),
    bold: Bold,
    italic: Italic,
    strike: Strike,
    underline: Underline,
    code: Code,
    superscript: Superscript,
    subscript: Subscript,
    highlight: buildHighlightExtension(parsers?.highlight),
    textStyle: buildTextStyleExtension(parsers?.textStyle),
    link: buildLinkExtension(parsers?.link),
    anchor: buildAnchorExtension(parsers?.anchor),
    styled: buildStyledExtension(parsers?.styled),
    ...(enableReporter && { reporter: Reporter }),
  };
}
