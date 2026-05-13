import { buildBlockquoteExtension, buildBulletListExtension, buildCodeBlockExtension, buildComponentBlokExtension, buildEmojiExtension, buildHardBreakExtension, buildHeadingExtension, buildHorizontalRuleExtension, buildImageExtension, buildListItemExtension, buildOrderedListExtension, buildParagraphExtension, buildTableCellExtension, buildTableExtension, buildTableHeaderExtension, buildTableRowExtension, Details, DetailsContent, DetailsSummary, Document, Text } from './nodes';
import type { ExtensionKey, ExtensionOptions } from './richtext-attrs';
import { Bold, buildAnchorExtension, buildHighlightExtension, buildLinkExtension, buildStyledExtension, buildTextStyleExtension, Code, Italic, Reporter, Strike, Subscript, Superscript, Underline } from './marks';

export interface StyleOption {
  name: string;
  value: string;
}

export type StoryblokNodeExtensionOptionsMap = {
  [K in ExtensionKey]?: ExtensionOptions<K>;
};

export interface HTMLParserOptions {
  extensions?: StoryblokNodeExtensionOptionsMap;
  allowCustomAttributes?: boolean;
  styleOptions?: StyleOption[];
  preserveWhitespace?: boolean;
}

interface GetStoryblokTiptapExtensionsOptions extends HTMLParserOptions {
  enableReporter?: boolean;
}

export function getStoryblokTiptapExtensions(options: GetStoryblokTiptapExtensionsOptions) {
  const extensions = options?.extensions || {};
  const enableReporter = options?.enableReporter || false;
  return {
    document: Document,
    text: Text,
    details: Details,
    detailsContent: DetailsContent,
    detailsSummary: DetailsSummary,
    emoji: buildEmojiExtension(extensions?.emoji),
    paragraph: buildParagraphExtension(extensions?.paragraph),
    blockquote: buildBlockquoteExtension(),
    heading: buildHeadingExtension(extensions?.heading),
    bulletList: buildBulletListExtension(),
    orderedList: buildOrderedListExtension(extensions?.ordered_list),
    listItem: buildListItemExtension(),
    codeBlock: buildCodeBlockExtension(extensions?.code_block),
    hardBreak: buildHardBreakExtension(),
    horizontalRule: buildHorizontalRuleExtension(),
    image: buildImageExtension(extensions?.image),
    table: buildTableExtension(),
    tableRow: buildTableRowExtension(),
    tableCell: buildTableCellExtension(extensions?.tableCell),
    tableHeader: buildTableHeaderExtension(extensions?.tableHeader),
    blok: buildComponentBlokExtension(extensions?.blok),
    bold: Bold,
    italic: Italic,
    strike: Strike,
    underline: Underline,
    code: Code,
    superscript: Superscript,
    subscript: Subscript,
    highlight: buildHighlightExtension(extensions?.highlight),
    textStyle: buildTextStyleExtension(extensions?.textStyle),
    link: buildLinkExtension(extensions?.link),
    anchor: buildAnchorExtension(extensions?.anchor),
    styled: buildStyledExtension(extensions?.styled),
    ...(enableReporter && { reporter: Reporter }),
  };
}
