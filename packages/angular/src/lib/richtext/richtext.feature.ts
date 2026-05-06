import { InjectionToken, Type, Injectable, inject, InputSignal } from '@angular/core';
import type { SbRichTextElement } from '@storyblok/richtext/static';

import { type StoryblokFeature, BaseComponentResolver } from '../components.feature';
import { RichTextComponentProps } from '../types';

export type RichTextAngularComponent<T extends SbRichTextElement> = Type<{
  data: InputSignal<RichTextComponentProps<T>>;
}>;

type RichtextComponentLoader<T extends SbRichTextElement> = () => Promise<
  RichTextAngularComponent<T>
>;
/**
 * Map of Storyblok segment types to Angular components.
 * Supports both eager (direct) and lazy (dynamic import) loading.
 *
 * @example
 * ```typescript
 * // Eager loading (bundled immediately)
 * const components: SbAngularComponentMap = {
 *   link: CustomLinkComponent,
 *   image: OptimizedImageComponent,
 * };
 *
 * // Lazy loading (loaded on-demand) - recommended
 * const components: SbAngularComponentMap = {
 *   link: () => import('./custom-link').then(m => m.CustomLinkComponent),
 *   image: () => import('./optimized-image').then(m => m.OptimizedImageComponent),
 * };
 * ```
 */
export type SbAngularComponentMap = {
  [K in SbRichTextElement]?: RichtextComponentLoader<K>;
};

/**
 * Injection token for richtext component overrides.
 * Defaults to an empty map if not provided.
 */
export const STORYBLOK_RICHTEXT_COMPONENTS = new InjectionToken<SbAngularComponentMap>(
  'STORYBLOK_RICHTEXT_COMPONENTS',
  { factory: () => ({}) },
);

/**
 * Service for resolving richtext components with lazy loading support.
 * Caches resolved components to avoid repeated dynamic imports.
 */
@Injectable({ providedIn: 'root' })
export class StoryblokRichtextResolver extends BaseComponentResolver<SbRichTextElement> {
  protected readonly registry = inject(STORYBLOK_RICHTEXT_COMPONENTS);

  /** Get all registered segment types (for determining which nodes become component nodes). */
  getRegisteredTypes(): SbRichTextElement[] {
    return this.getRegisteredKeys();
  }
}

/**
 * Registers custom components for richtext node rendering.
 * Supports both eager and lazy loading of components.
 *
 * @param components - Map of segment types to Angular components
 * @returns A feature to pass to `provideStoryblok()`
 *
 * @example
 * ```typescript
 * // Lazy loading (recommended)
 * provideStoryblok(
 *   { accessToken: 'your-token' },
 *   withStoryblokRichtextComponents({
 *     link: () => import('./custom-link').then(m => m.CustomLinkComponent),
 *     image: () => import('./optimized-image').then(m => m.OptimizedImageComponent),
 *   })
 * )
 *
 * // Eager loading
 * provideStoryblok(
 *   { accessToken: 'your-token' },
 *   withStoryblokRichtextComponents({
 *     link: CustomLinkComponent,
 *     image: OptimizedImageComponent,
 *   })
 * )
 * ```
 */
export function withStoryblokRichtextComponents(
  components: SbAngularComponentMap,
): StoryblokFeature {
  return {
    ɵkind: 'richtext',
    ɵproviders: [{ provide: STORYBLOK_RICHTEXT_COMPONENTS, useValue: components }],
  };
}
