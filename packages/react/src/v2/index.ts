export interface SbBlokData {
  _uid: string;
  component: string;
  _editable?: string;
  [key: string]: unknown;
}

export { createRegistry } from './component-registry';
export {
  type ContentApiClientConfig,
  createApiClient,
  type Story,
} from '@storyblok/api-client';

export { storyblokEditable } from '@storyblok/live-preview';
