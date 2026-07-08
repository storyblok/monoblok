import { InjectionToken, Type, Injectable, inject, InputSignal } from '@angular/core';
import type { SbRichTextElement, SbRichTextElementByType, SbRichTextImageOptions } from '@storyblok/richtext';

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
 * Context passed to every custom richtext node/mark component alongside its `data` input.
 * Carries renderer-wide settings so custom components can read them without prop drilling.
 *
 * @example
 * ```typescript
 * \@Component({ template: `{{ context()?.data?.prefix }} {{ data().text }}` })
 * class CustomTextComponent {
 *   readonly data    = input.required<SbAngularRichTextProps<'text'>>();
 *   readonly context = input<SbAngularRichTextRenderContext>();
 * }
 * ```
 *
 * When recursively rendering children, forward context so nested components
 * also receive it:
 * ```html
 * <sb-rich-text [sbDocument]="data().content" [sbData]="context()?.data" />
 * ```
 */
export interface SbAngularRichTextRenderContext {
  /** Arbitrary user data passed as `[sbData]` on `<sb-rich-text>`. */
  data?: unknown;
  /** Mirror of the `[sbOptimizeImage]` input on the host `<sb-rich-text>`. */
  optimizeImage?: boolean | Partial<SbRichTextImageOptions>;
}

/**
 * Angular component type for custom richtext nodes/marks.
 * Declare a `context` input to receive renderer-wide context (sbData, optimizeImage).
 */
export type SbAngularRichTextComponent<T extends SbRichTextElement> = Type<{
  data: InputSignal<SbAngularRichTextProps<T>>;
  context?: InputSignal<SbAngularRichTextRenderContext | undefined>;
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
 * Injection token for richtext element types that should be skipped when looking up
 * custom components. Used internally to prevent infinite loops when a custom component
 * renders `<sb-rich-text>` for its own children — the renderer creates a child
 * EnvironmentInjector that provides this token with the current element type, so the
 * nested `<sb-rich-text>` falls back to native HTML rendering for that type.
 */
export const STORYBLOK_RICHTEXT_EXCLUDED_TYPES = new InjectionToken<ReadonlySet<string>>(
  'STORYBLOK_RICHTEXT_EXCLUDED_TYPES',
  { factory: () => new Set<string>() },
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
