import type { SbRichTextNode } from '../static';

export interface HtmlFixture {
  title: string;
  input: SbRichTextNode | SbRichTextNode[];
  expected: string;
};
