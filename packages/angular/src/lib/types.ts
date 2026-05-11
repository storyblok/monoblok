import { ISbComponentType } from '@storyblok/live-preview';
import { PMMark, PMNode, TiptapComponentName } from '@storyblok/richtext/static';

export type SbBlokKeyDataTypes = string | number | object | boolean | undefined;

export interface SbBlokData extends ISbComponentType<string> {
  [index: string]: SbBlokKeyDataTypes;
}

//TODO: This is a temporary this should come from the rich text package
type RichTextBaseProps<T extends TiptapComponentName> = T extends PMNode['type']
  ? Extract<
      PMNode,
      {
        type: T;
      }
    >
  : T extends PMMark['type']
    ? Extract<
        PMMark,
        {
          type: T;
        }
      >
    : never;

export type RichTextComponentProps<T extends TiptapComponentName> = RichTextBaseProps<T>;
