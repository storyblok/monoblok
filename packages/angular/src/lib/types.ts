import { SbRichTextElement, SbRichTextProps } from '@storyblok/richtext/static';

export interface ISbComponentType<T extends string> {
  _uid?: string;
  component?: T;
  _editable?: string;
}

export type SbBlokKeyDataTypes = string | number | object | boolean | undefined;

export interface SbBlokData extends ISbComponentType<string> {
  [index: string]: SbBlokKeyDataTypes;
}

export type RichTextComponentProps<T extends SbRichTextElement> = SbRichTextProps<T>;
