import type { ISbComponentType } from 'storyblok-js-client';
import type { Mark as PMMark, Node as PMNode } from '@tiptap/pm/model';

export type SbBlokKeyDataTypes = string | number | object | boolean | undefined;
export interface SbBlokData extends ISbComponentType<string> {
  [index: string]: SbBlokKeyDataTypes;
}
export interface ParsedDOMSpec {
  tag: string;
  attrs: Record<string, any>;
  hasHole: boolean;
  children: Array<ParsedDOMSpec | string | { hole: true }>;
}

export { PMMark, PMNode };
