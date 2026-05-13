import type { SbRichTextDoc } from '../static/types';

export interface HtmlFixture {
  title: string;
  input: SbRichTextDoc | SbRichTextDoc[];
  expected: string;
};
