import { type ComponentType, type ReactNode, Suspense } from 'react';
import type { SbBlokData } from '.';

/** Internal type: how the registry calls components (always passes SbBlokData) */
type StoryblokComponentType = ComponentType<{ blok: SbBlokData }>;

/**
 * Registration type: accepts any component whose blok prop is a subtype of SbBlokData.
 * Using `any` here intentionally avoids contravariance errors — components that declare
 * specific blok shapes (e.g. `SbBlokData & { headline: string }`) are valid entries.
 */
type AnyBlokComponent = ComponentType<{ blok: any }>;

/**
 * Component entry that supports async components with Suspense.
 * Can be either a plain component or a config object with fallback.
 */
export type ComponentEntry =
  | AnyBlokComponent
  | {
    component: AnyBlokComponent;
    /** Custom fallback for this component's Suspense boundary */
    fallback?: ReactNode;
    /** Whether to wrap in Suspense (auto-detected for lazy components, can be forced) */
    suspense?: boolean;
  };

export interface RegistryConfig {
  components: Record<string, ComponentEntry>;
  /** Fallback component when a blok type is not found */
  fallback?: AnyBlokComponent;
  /** Default Suspense fallback for async components */
  suspenseFallback?: ReactNode;
}

export interface RegistryResult {
  StoryblokComponent: ComponentType<{ blok: SbBlokData } & Record<string, unknown>>;
  StoryblokBlocks: ComponentType<{ blocks: SbBlokData[] } & Record<string, unknown>>;
  resolve: (name: string) => StoryblokComponentType | null;
}

/** Default fallback shown while async components load */
function DefaultSuspenseFallback(): ReactNode {
  return null;
}

/**
 * Check if a component is a lazy component (created with React.lazy).
 * Lazy components have $$typeof Symbol(react.lazy).
 */
function isLazyComponent(component: unknown): boolean {
  if (typeof component !== 'object' || component === null) {
    return false;
  }
  const typedComponent = component as { $$typeof?: symbol };
  return (
    typeof typedComponent.$$typeof === 'symbol'
    && typedComponent.$$typeof.toString() === 'Symbol(react.lazy)'
  );
}

/**
 * Normalize a component entry to extract component and config.
 */
function normalizeEntry(entry: ComponentEntry): {
  component: StoryblokComponentType;
  fallback?: ReactNode;
  suspense?: boolean;
} {
  if (typeof entry === 'function' || isLazyComponent(entry)) {
    return { component: entry as StoryblokComponentType };
  }
  return entry;
}

export function createRegistry(config: RegistryConfig): RegistryResult {
  const defaultSuspenseFallback = config.suspenseFallback ?? (
    <DefaultSuspenseFallback />
  );

  const resolve = (name: string): StoryblokComponentType | null => {
    const entry = config.components[name];
    if (!entry) {
      return config.fallback ?? null;
    }
    return normalizeEntry(entry).component;
  };

  function StoryblokComponent({ blok, ...rest }: { blok: SbBlokData } & Record<string, unknown>): ReactNode {
    const entry = config.components[blok.component];

    if (!entry) {
      if (config.fallback) {
        const FallbackComponent = config.fallback;
        return <FallbackComponent blok={blok} {...rest} />;
      }
      console.warn(`[Storyblok] Unknown component: ${blok.component}`);
      return null;
    }

    const { component: Component, fallback, suspense } = normalizeEntry(entry);

    // Determine if we should wrap in Suspense:
    // - Explicitly set via suspense option
    // - Auto-detected for lazy components
    const needsSuspense = suspense ?? isLazyComponent(Component);

    if (needsSuspense) {
      return (
        <Suspense fallback={fallback ?? defaultSuspenseFallback}>
          <Component blok={blok} {...rest} />
        </Suspense>
      );
    }

    return <Component blok={blok} {...rest} />;
  }

  function StoryblokBlocks({ blocks, ...rest }: { blocks: SbBlokData[] } & Record<string, unknown>): ReactNode {
    if (!blocks || blocks.length === 0) {
      return null;
    }

    return (
      <>
        {blocks.map(blok => (
          <StoryblokComponent key={blok._uid} blok={blok} {...rest} />
        ))}
      </>
    );
  }

  return {
    StoryblokComponent,
    StoryblokBlocks,
    resolve,
  };
}
