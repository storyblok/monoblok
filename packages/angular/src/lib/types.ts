import { SbRichTextElement, SbRichTextProps } from '@storyblok/richtext';

export type SbBlokKeyDataTypes = string | number | object | boolean | undefined;

export interface SbBlokData {
  _uid: string;
  component: string;
  _editable?: string;
  [index: string]: SbBlokKeyDataTypes;
}

export type SbAngularRichTextProps<T extends SbRichTextElement> = SbRichTextProps<T>;
