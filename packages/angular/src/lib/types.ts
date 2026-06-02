import { SbRichTextElement, SbRichTextProps } from '@storyblok/richtext/static';

export type SbBlokKeyDataTypes = string | number | object | boolean | undefined;

export interface SbBlokData {
  _uid: string;
  component: string;
  _editable?: string;
  [index: string]: SbBlokKeyDataTypes;
}

export type RichTextComponentProps<T extends SbRichTextElement> = SbRichTextProps<T>;
