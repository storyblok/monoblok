export interface SbBlokData {
  _uid: string;
  component: string;
  _editable?: string;
  [key: string]: unknown;
}

export { createRichTextRenderer } from '../core/richtext';
export { createRegistry } from './component-registry';

export { StoryblokRichText } from './StoryblokRichText';
export {
  type ContentApiClientConfig,
  createApiClient,
  type Story,
} from '@storyblok/api-client';
export { storyblokEditable } from '@storyblok/live-preview';
