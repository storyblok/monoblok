export interface SbBlokData {
  _uid: string;
  component: string;
  _editable?: string;
  [key: string]: unknown;
}

/**
 * Helper type for typing blok component props.
 * Use this instead of `{ blok: SbBlokData & { ... } }` to stay compatible
 * with the component registry.
 *
 * @example
 * type PageProps = StoryblokComponentProps<{ body: SbBlokData[] }>;
 * export default function Page({ blok }: PageProps) { ... }
 */
export interface StoryblokComponentProps<T extends Record<string, unknown> = Record<string, unknown>> {
  blok: SbBlokData & T;
}

export { createRichTextRenderer } from '../core/richtext';
export { type ComponentEntry, createRegistry, type RegistryConfig, type RegistryResult } from './component-registry';

export { StoryblokRichText } from './StoryblokRichText';
export {
  type ContentApiClientConfig,
  createApiClient,
  type Story,
} from '@storyblok/api-client';
export { storyblokEditable } from '@storyblok/live-preview';
