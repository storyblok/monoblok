import type { ISbComponentType } from 'storyblok-js-client';

export type { ISbStoryData } from 'storyblok-js-client';

export type SbBlokKeyDataTypes = string | number | object | boolean | undefined;

export interface SbBlokData extends ISbComponentType<string> {
  [index: string]: SbBlokKeyDataTypes;
}
