export type SbBlokKeyDataTypes = string | number | object | boolean | undefined;

export interface SbBlokData {
  _uid: string;
  component: string;
  _editable?: string;
  [index: string]: SbBlokKeyDataTypes;
}

// Re-export the richtext props type from the feature module
export type {
  SbAngularRichTextProps,
  SbAngularRichTextComponent,
  SbAngularRichTextComponentMap,
} from './richtext/richtext.feature';
