import { type ComponentType, type ReactNode, Suspense } from "react";
import type { StoryblokBlockData } from "./types";
import { createStoryblokRichText } from "./richtext/create-storyblok-richtext";

/** Internal type: how the registry calls components (always passes StoryblokBlockData) */
type BlockComponentType = ComponentType<{ block: StoryblokBlockData }>;

/**
 * Registration type: accepts any component whose block prop is a subtype of StoryblokBlockData.
 * Using `any` intentionally avoids contravariance errors for components with specific block shapes.
 */
type AnyBlockComponent = ComponentType<{ block: any }>;

/**
 * A value accepted as a Suspense fallback: either a rendered node or a component with no
 * required props (passed as `WeatherWidgetSkeleton` or `<WeatherWidgetSkeleton />`).
 */
export type SuspenseFallback = ReactNode | ComponentType<object>;

/**
 * Normalizes a SuspenseFallback value to a ReactNode.
 * If a component type is passed it is instantiated with no props.
 */
function resolveSuspenseFallback(fallback: SuspenseFallback): ReactNode {
  if (typeof fallback === "function") {
    const F = fallback as ComponentType<object>;
    return <F />;
  }
  return fallback as ReactNode;
}

/**
 * A component entry in the Storyblok component map.
 * Can be either a plain component or a config object with Suspense options.
 */
export type StoryblokComponentEntry =
  | AnyBlockComponent
  | {
      component: AnyBlockComponent;
      /**
       * Custom fallback for this component's Suspense boundary.
       * Accepts a ReactNode (`<Skeleton />`) or a component type (`Skeleton`).
       */
      fallback?: SuspenseFallback;
      /** Whether to wrap in Suspense (auto-detected for lazy components, can be forced) */
      suspense?: boolean;
    };

/** Options passed to {@link defineStoryblokComponents}. */
export interface StoryblokComponentsOptions {
  components: Record<string, StoryblokComponentEntry>;
  /** Fallback component when a block type is not found */
  fallback?: AnyBlockComponent;
  /**
   * Default Suspense fallback for async components.
   * Accepts a ReactNode (`<Skeleton />`) or a component type (`Skeleton`).
   */
  suspenseFallback?: SuspenseFallback;
}

/** Components returned by {@link defineStoryblokComponents}, pre-wired to the same component map. */
export interface StoryblokComponentsResult {
  /**
   * Renders a single block or an array of blocks by looking up `block.component` in the map.
   *
   * @example
   * ```tsx
   * <StoryblokComponent block={story.content} />
   * <StoryblokComponent block={story.content.body} />
   * ```
   */
  StoryblokComponent: ComponentType<
    { block: StoryblokBlockData | StoryblokBlockData[] } & Record<string, unknown>
  >;
  /** Renders a richtext document, resolving embedded blocks via the same component map. */
  StoryblokRichText: ReturnType<typeof createStoryblokRichText>;
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
  if (typeof component !== "object" || component === null) {
    return false;
  }
  const typedComponent = component as { $$typeof?: symbol };
  return (
    typeof typedComponent.$$typeof === "symbol" &&
    typedComponent.$$typeof.toString() === "Symbol(react.lazy)"
  );
}

/**
 * Normalize a component entry to extract component and config.
 */
function normalizeEntry(entry: StoryblokComponentEntry): {
  component: BlockComponentType;
  fallback?: SuspenseFallback;
  suspense?: boolean;
} {
  if (typeof entry === "function" || isLazyComponent(entry)) {
    return { component: entry as BlockComponentType };
  }
  return entry;
}

/**
 * Maps Storyblok block types to React components and returns pre-wired
 * `StoryblokComponent` and `StoryblokRichText`.
 *
 * @example
 * ```tsx
 * export const { StoryblokComponent, StoryblokRichText } = defineStoryblokComponents({
 *   components: {
 *     page: Page,
 *     teaser: Teaser,
 *     weather_widget: {
 *       component: WeatherWidget,
 *       fallback: WeatherWidgetSkeleton,   // component type
 *       // fallback: <WeatherWidgetSkeleton />,  // or a ReactNode — both work
 *       suspense: true,
 *     },
 *   },
 *   fallback: FallbackBlock,
 *   suspenseFallback: GlobalSkeleton,     // component type or ReactNode
 * });
 * ```
 */
export function defineStoryblokComponents(
  config: StoryblokComponentsOptions,
): StoryblokComponentsResult {
  const defaultSuspenseFallback: ReactNode =
    config.suspenseFallback !== undefined ? (
      resolveSuspenseFallback(config.suspenseFallback)
    ) : (
      <DefaultSuspenseFallback />
    );

  function StoryblokComponent({
    block,
    ...rest
  }: { block: StoryblokBlockData | StoryblokBlockData[] } & Record<string, unknown>): ReactNode {
    // ── Array path ──────────────────────────────────────────────────────────
    if (Array.isArray(block)) {
      if (block.length === 0) return null;
      return (
        <>
          {block.map((b, i) => (
            <StoryblokComponent key={b._uid ?? i} block={b} {...rest} />
          ))}
        </>
      );
    }

    // ── Null guard ──────────────────────────────────────────────────────────
    if (!block) {
      console.error("[Storyblok] StoryblokComponent: 'block' prop is required.");
      return null;
    }

    // ── Single block path ───────────────────────────────────────────────────
    const entry = config.components[block.component];

    if (!entry) {
      if (config.fallback) {
        const FallbackComponent = config.fallback;
        return <FallbackComponent block={block} {...rest} />;
      }
      console.warn(`[Storyblok] No component registered for "${block.component}".`);
      return null;
    }

    const { component: Component, fallback, suspense } = normalizeEntry(entry);
    const needsSuspense = suspense ?? isLazyComponent(Component);

    if (needsSuspense) {
      return (
        <Suspense
          fallback={
            fallback !== undefined ? resolveSuspenseFallback(fallback) : defaultSuspenseFallback
          }
        >
          <Component block={block} {...rest} />
        </Suspense>
      );
    }

    return <Component block={block} {...rest} />;
  }

  StoryblokComponent.displayName = "StoryblokComponent";

  return {
    StoryblokComponent,
    get StoryblokRichText() {
      return createStoryblokRichText(StoryblokComponent as BlockComponentType);
    },
  };
}
