import { ISbComponentType } from '@storyblok/live-preview';
import { SbRichTextElement, SbRichTextProps } from '@storyblok/richtext';

export type SbBlokKeyDataTypes = string | number | object | boolean | undefined;

export interface SbBlokData extends ISbComponentType<string> {
  [index: string]: SbBlokKeyDataTypes;
}

export type SbAngularRichTextProps<T extends SbRichTextElement> = SbRichTextProps<T>;
