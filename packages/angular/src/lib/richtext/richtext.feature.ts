import { InjectionToken, Type, Injectable, inject, InputSignal } from '@angular/core';
import type { SbRichTextElement, SbRichTextElementByType } from '@storyblok/richtext';

import { type StoryblokFeature, BaseComponentResolver } from '../components.feature';

/**
 * Props type for Angular richtext node/mark components.
 * Does not include `children` since Angular uses `<ng-content>` for content projection.
 *
 * For nodes (heading, paragraph, etc.), use `<sb-rich-text [sbDocument]="data().content" />`
 * to render nested content.
 *
 * For marks (link, bold, etc.), use `<ng-content />` since content is projected automatically.
 */
export type SbAngularRichTextProps<T extends SbRichTextElement> = SbRichTextElementByType[T];

/**
 * Angular component type for custom richtext nodes/marks.
 */
export type SbAngularRichTextComponent<T extends SbRichTextElement> = Type<{
  data: InputSignal<SbAngularRichTextProps<T>>;
}>;

/**
 * Lazy loader function for richtext components.
 */
type SbAngularRichTextComponentLoader<T extends SbRichTextElement> = () => Promise<
  SbAngularRichTextComponent<T>
>;

/**
 * Strongly-typed component map for Storyblok rich text elements.
 * Supports both eager (direct) and lazy (dynamic import) loading.
 *
 * @example
 * ```typescript
 * // Eager loading (bundled immediately)
 * const components: SbAngularRichTextComponentMap = {
 *   link: CustomLinkComponent,
 *   image: OptimizedImageComponent,
 * };
 *
 * // Lazy loading (loaded on-demand) - recommended
 * const components: SbAngularRichTextComponentMap = {
 *   link: () => import('./custom-link').then(m => m.CustomLinkComponent),
 *   image: () => import('./optimized-image').then(m => m.OptimizedImageComponent),
 * };
 * ```
 */
export type SbAngularRichTextComponentMap = {
  [K in SbRichTextElement]?: SbAngularRichTextComponent<K> | SbAngularRichTextComponentLoader<K>;
};

/**
 * @deprecated Use `SbAngularRichTextComponentMap` instead. This alias exists for backwards compatibility.
 */
export type SbAngularComponentMap = SbAngularRichTextComponentMap;

/**
 * Injection token for richtext component overrides.
 * Defaults to an empty map if not provided.
 */
export const STORYBLOK_RICHTEXT_COMPONENTS = new InjectionToken<SbAngularRichTextComponentMap>(
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
  components: SbAngularRichTextComponentMap,
): StoryblokFeature {
  return {
    ɵkind: 'richtext',
    ɵproviders: [{ provide: STORYBLOK_RICHTEXT_COMPONENTS, useValue: components }],
  };
}
