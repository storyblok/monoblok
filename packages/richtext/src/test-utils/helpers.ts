import type {
  RichTextDoc,
  RichTextFieldValueLinkMark,
  RichTextMark,
  RichTextNode,
} from "../generated/overlay/types.gen";

export const text = (content: string, marks?: RichTextMark[] | undefined): RichTextNode => ({
  type: "text",
  text: content,
  ...(marks && { marks }),
});

export const linkMark = (
  href: string,
  options: {
    uuid?: string;
    target?: "_blank" | "_self";
    linktype?: "url" | "story" | "email" | "asset";
    anchor?: string;
    custom?: Record<string, unknown>;
  } = {},
): RichTextFieldValueLinkMark => ({
  type: "link",
  attrs: {
    href,
    linktype: options.linktype ?? "url",
    target: options.target ?? null,
    anchor: options.anchor ?? null,
    uuid: options.uuid ?? null,
    custom: options.custom ?? undefined,
  },
});

export const tableCell = (
  content: string,
  attrs: {
    colspan?: number;
    rowspan?: number;
    colwidth?: number[];
    backgroundColor?: string;
  } = {},
  marks?: RichTextMark[] | undefined,
): RichTextNode => ({
  type: "tableCell",
  content: [{ type: "paragraph", content: [text(content, marks)] }],
  attrs: {
    colspan: attrs.colspan ?? 1,
    rowspan: attrs.rowspan ?? 1,
    ...(attrs.colwidth && { colwidth: attrs.colwidth }),
    ...(attrs.backgroundColor && { backgroundColor: attrs.backgroundColor }),
  },
});

export const tableHeader = (content: string, marks?: RichTextMark[] | undefined): RichTextNode => ({
  type: "tableHeader",
  content: [{ type: "paragraph", content: [text(content, marks)] }],
  attrs: { colspan: 1, rowspan: 1 },
});

export const tableRow = (cells: RichTextNode[]): RichTextNode => ({
  type: "tableRow",
  content: cells,
});

export const table = (rows: RichTextNode[]): RichTextNode => ({
  type: "table",
  content: rows,
});

export const doc = (content: RichTextNode | RichTextNode[]): RichTextDoc => ({
  type: "doc",
  content: Array.isArray(content) ? content : [content],
});
