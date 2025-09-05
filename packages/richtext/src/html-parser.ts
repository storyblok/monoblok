import type {
  StoryblokRichTextDocumentNode,
} from './types';
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { generateJSON } from '@tiptap/html';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
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
import Link from '@tiptap/extension-link';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Text from '@tiptap/extension-text';
import type { Node } from '@tiptap/core';
import Underline from '@tiptap/extension-underline';

export interface StyleOption {
  name: string;
  value: string;
}

export interface HTMLParserOptions {
  allowCustomAttributes?: boolean;
  tipTapExtensions?: Node[];
  styleOptions?: StyleOption[];
}

/**
 * Convert HTML to Storyblok Rich Text format.
 */
export function htmlToStoryblokRichtext(
  html: string,
  options: HTMLParserOptions = {},
): StoryblokRichTextDocumentNode {
  return generateJSON(html, [
    Blockquote,
    Bold,
    BulletList,
    Code,
    CodeBlock,
    Details,
    DetailsContent,
    DetailsSummary,
    Document,
    Emoji,
    HardBreak,
    Heading,
    Highlight,
    HorizontalRule,
    Image,
    Italic,
    Link,
    ListItem,
    OrderedList,
    Paragraph,
    Strike,
    Subscript,
    Superscript,
    Table,
    TableCell,
    TableHeader,
    TableRow,
    Text,
    TextStyleKit,
    Underline,
    ...(options.tipTapExtensions || []),
  ]);
}
