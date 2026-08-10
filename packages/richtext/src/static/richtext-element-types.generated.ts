// THIS FILE IS AUTO-GENERATED. DO NOT EDIT.

import type {
  RichTextMark,
  RichTextNode,
  RichTextFieldValueAnchorMark,
  RichTextFieldValueBlockNode,
  RichTextFieldValueBlockquoteNode,
  RichTextFieldValueCodeBlockNode,
  RichTextFieldValueEmojiNode,
  RichTextFieldValueHeadingNode,
  RichTextFieldValueHighlightMark,
  RichTextFieldValueImageNode,
  RichTextFieldValueLinkMark,
  RichTextFieldValueListItemNode,
  RichTextFieldValueOrderedListNode,
  RichTextFieldValueParagraphNode,
  RichTextFieldValueStyledMark,
  RichTextFieldValueTableCellNode,
  RichTextFieldValueTableHeaderNode,
  RichTextFieldValueTextStyleMark,
} from "../generated/overlay/types.gen";

export interface StoryblokRichTextElementByType<TContext = unknown> {
  doc: {
    type: "doc";
    content: RichTextNode[];
    _key?: string;
    context?: TContext;
  };
  paragraph: {
    type: "paragraph";
    attrs?: RichTextFieldValueParagraphNode["attrs"];
    content?: RichTextNode[];
    marks?: RichTextMark[];
    _key?: string;
    context?: TContext;
  };
  text: {
    type: "text";
    text: string;
    marks?: RichTextMark[];
    _key?: string;
    context?: TContext;
  };
  heading: {
    type: "heading";
    attrs: RichTextFieldValueHeadingNode["attrs"];
    content?: RichTextNode[];
    marks?: RichTextMark[];
    _key?: string;
    context?: TContext;
  };
  blockquote: {
    type: "blockquote";
    attrs?: RichTextFieldValueBlockquoteNode["attrs"];
    content?: RichTextNode[];
    marks?: RichTextMark[];
    _key?: string;
    context?: TContext;
  };
  bullet_list: {
    type: "bullet_list";
    content?: RichTextNode[];
    marks?: RichTextMark[];
    _key?: string;
    context?: TContext;
  };
  ordered_list: {
    type: "ordered_list";
    attrs: RichTextFieldValueOrderedListNode["attrs"];
    content?: RichTextNode[];
    marks?: RichTextMark[];
    _key?: string;
    context?: TContext;
  };
  list_item: {
    type: "list_item";
    attrs?: RichTextFieldValueListItemNode["attrs"];
    content?: RichTextNode[];
    marks?: RichTextMark[];
    _key?: string;
    context?: TContext;
  };
  code_block: {
    type: "code_block";
    attrs: RichTextFieldValueCodeBlockNode["attrs"];
    content?: RichTextNode[];
    marks?: RichTextMark[];
    _key?: string;
    context?: TContext;
  };
  hard_break: {
    type: "hard_break";
    _key?: string;
    context?: TContext;
  };
  horizontal_rule: {
    type: "horizontal_rule";
    _key?: string;
    context?: TContext;
  };
  image: {
    type: "image";
    attrs: RichTextFieldValueImageNode["attrs"];
    _key?: string;
    context?: TContext;
  };
  emoji: {
    type: "emoji";
    attrs: RichTextFieldValueEmojiNode["attrs"];
    _key?: string;
    context?: TContext;
  };
  table: {
    type: "table";
    content?: RichTextNode[];
    _key?: string;
    context?: TContext;
  };
  tableRow: {
    type: "tableRow";
    content?: RichTextNode[];
    _key?: string;
    context?: TContext;
  };
  tableCell: {
    type: "tableCell";
    attrs: RichTextFieldValueTableCellNode["attrs"];
    content?: RichTextNode[];
    _key?: string;
    context?: TContext;
  };
  tableHeader: {
    type: "tableHeader";
    attrs: RichTextFieldValueTableHeaderNode["attrs"];
    content?: RichTextNode[];
    _key?: string;
    context?: TContext;
  };
  blok: {
    type: "blok";
    attrs: RichTextFieldValueBlockNode["attrs"];
    _key?: string;
    context?: TContext;
  };
  link: {
    type: "link";
    attrs: RichTextFieldValueLinkMark["attrs"];
    _key?: string;
    context?: TContext;
  };
  bold: {
    type: "bold";
    _key?: string;
    context?: TContext;
  };
  italic: {
    type: "italic";
    _key?: string;
    context?: TContext;
  };
  strike: {
    type: "strike";
    _key?: string;
    context?: TContext;
  };
  underline: {
    type: "underline";
    _key?: string;
    context?: TContext;
  };
  code: {
    type: "code";
    _key?: string;
    context?: TContext;
  };
  superscript: {
    type: "superscript";
    _key?: string;
    context?: TContext;
  };
  subscript: {
    type: "subscript";
    _key?: string;
    context?: TContext;
  };
  highlight: {
    type: "highlight";
    attrs: RichTextFieldValueHighlightMark["attrs"];
    _key?: string;
    context?: TContext;
  };
  textStyle: {
    type: "textStyle";
    attrs: RichTextFieldValueTextStyleMark["attrs"];
    _key?: string;
    context?: TContext;
  };
  anchor: {
    type: "anchor";
    attrs: RichTextFieldValueAnchorMark["attrs"];
    _key?: string;
    context?: TContext;
  };
  styled: {
    type: "styled";
    attrs: RichTextFieldValueStyledMark["attrs"];
    _key?: string;
    context?: TContext;
  };
}
