import { InjectionToken, Type, Provider } from '@angular/core';

/**
 * Lazy component loader function type.
 * Returns a promise that resolves to a component type.
 *
 * @example
 * ```typescript
 * const loader: StoryblokComponentLoader = () =>
 *   import('./teaser/teaser').then(m => m.Teaser);
 * ```
 */
export type StoryblokComponentLoader = () => Promise<Type<any>>;

/**
 * Registry mapping Storyblok component names to Angular components.
 * Supports both eager (direct) and lazy (dynamic import) loading.
 *
 * @example
 * ```typescript
 * // Eager loading (bundled immediately)
 * const components: StoryblokComponentsMap = {
 *   teaser: TeaserComponent
 * };
 *
 * // Lazy loading (loaded on-demand) - recommended
 * const components: StoryblokComponentsMap = {
 *   teaser: () => import('./teaser/teaser').then(m => m.Teaser)
 * };
 * ```
 */
export type StoryblokComponentsMap = Record<string, Type<any> | StoryblokComponentLoader>;

/**
 * Injection token for the Storyblok components registry.
 * Used internally by the `SbBlokDirective` to resolve components.
 */
export const STORYBLOK_COMPONENTS = new InjectionToken<StoryblokComponentsMap>(
  'STORYBLOK_COMPONENTS',
);

/**
 * Feature interface for Storyblok provider features.
 * @internal
 */
/**
 * Discriminated union for Storyblok provider features.
 */

export type StoryblokFeature =
  | { ɵkind: 'components'; ɵproviders: Provider[] }
  | { ɵkind: 'livePreview'; ɵproviders: Provider[] };

/**
 * Registers Storyblok components for dynamic rendering.
 * Use with `provideStoryblok()` to register your components.
 *
 * Components can be registered with either eager or lazy loading:
 * - **Eager**: Component is bundled in the main bundle
 * - **Lazy**: Component is loaded on-demand (recommended for better performance)
 *
 * @param components - Map of Storyblok component names to Angular components
 * @returns A feature to pass to `provideStoryblok()`
 *
 * @example
 * ```typescript
 * // Lazy loading (recommended)
 * provideStoryblok(
 *   { accessToken: 'your-token' },
 *   withStoryblokComponents({
 *     page: () => import('./components/page/page').then(m => m.Page),
 *     teaser: () => import('./components/teaser/teaser').then(m => m.Teaser),
 *     grid: () => import('./components/grid/grid').then(m => m.Grid),
 *   })
 * )
 *
 * // Eager loading (simpler but larger bundle)
 * provideStoryblok(
 *   { accessToken: 'your-token' },
 *   withStoryblokComponents({
 *     page: PageComponent,
 *     teaser: TeaserComponent,
 *   })
 * )
 * ```
 */
export function withStoryblokComponents(components: StoryblokComponentsMap): StoryblokFeature {
  return {
    ɵkind: 'components',
    ɵproviders: [{ provide: STORYBLOK_COMPONENTS, useValue: components }],
  };
}

/**
 * Type guard to check if a component entry is a lazy loader function.
 *
 * @param component - Component or loader function
 * @returns True if the component is a lazy loader
 */
export function isComponentLoader(
  component: Type<any> | StoryblokComponentLoader,
): component is StoryblokComponentLoader {
  return typeof component === 'function' && component.length === 0 && !component.prototype;
}
