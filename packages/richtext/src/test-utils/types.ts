import type { SbRichTextInput } from '../static';

export interface HtmlFixture {
  title: string;
  input: NonNullable<SbRichTextInput>;
  expected: string;
};
