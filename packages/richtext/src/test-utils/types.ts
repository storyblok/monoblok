import type { RichTextDoc, RichTextNode } from "../generated/overlay/types.gen";

export interface HtmlFixture {
  title: string;
  input: RichTextDoc | RichTextNode | RichTextNode[];
  expected: string;
}
