import { InjectionToken, Type, Provider, Directive } from '@angular/core';

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
  | { ɵkind: 'livePreview'; ɵproviders: Provider[] }
  | { ɵkind: 'richtext'; ɵproviders: Provider[] };

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

/**
 * Generic registry type for component maps.
 * Maps keys of type K to either eager components or lazy loaders.
 */
export type ComponentRegistry<K extends string = string> = Partial<
  Record<K, Type<unknown> | StoryblokComponentLoader>
>;

/**
 * Abstract base class for component resolvers.
 * Provides common logic for resolving components from a registry with caching support.
 *
 * @typeParam K - The key type used in the registry (e.g., string, StoryblokSegmentType)
 */
@Directive()
export abstract class BaseComponentResolver<K extends string = string> {
  protected abstract readonly registry: ComponentRegistry<K> | null;
  protected readonly cache = new Map<K, Type<unknown>>();

  /** Check if a component is registered for the given key. */
  has(key: K): boolean {
    return this.registry?.[key] != null;
  }

  /**
   * Get the component synchronously if it's eagerly loaded or already cached.
   * Returns null if the component needs to be loaded asynchronously.
   */
  getSync(key: K): Type<unknown> | null {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const entry = this.registry?.[key];
    if (!entry) return null;

    if (!isComponentLoader(entry)) {
      this.cache.set(key, entry);
      return entry;
    }

    return null;
  }

  /** Resolve a component asynchronously. Handles both eager and lazy components. */
  async resolve(key: K): Promise<Type<unknown> | null> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const entry = this.registry?.[key];
    if (!entry) return null;

    let component: Type<unknown>;
    if (isComponentLoader(entry)) {
      component = await entry();
    } else {
      component = entry;
    }

    this.cache.set(key, component);
    return component;
  }

  /** Get all registered keys. */
  getRegisteredKeys(): K[] {
    return this.registry ? (Object.keys(this.registry) as K[]) : [];
  }
}
