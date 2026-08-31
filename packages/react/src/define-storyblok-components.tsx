import { type ComponentType, type ReactNode, Suspense } from "react";
import type { BlockContent } from "./types";
import { createStoryblokRichText } from "./richtext/create-storyblok-richtext";

/** Internal type: how the registry calls components (always passes BlockContent) */
type BlockComponentType = ComponentType<{ block: BlockContent }>;

/**
 * Registration type: accepts any component whose block prop is a subtype of BlockContent.
 * Using `any` intentionally avoids contravariance errors for components with specific block shapes.
 */
type AnyBlockComponent = ComponentType<{ block: any }>;

/** A value accepted as a Suspense fallback (passed as `<Skeleton />`). */
export type SuspenseFallback = ReactNode;

/**
 * A component entry in the Storyblok component map.
 * Can be either a plain component or a config object with Suspense options.
 */
export type StoryblokComponentEntry =
  | AnyBlockComponent
  | {
      component: AnyBlockComponent;
      /**
       * Custom fallback for this component's Suspense boundary (`<Skeleton />`).
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
   * Default Suspense fallback for async components (`<GlobalSkeleton />`).
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
    { block: BlockContent | BlockContent[] } & Record<string, unknown>
  >;
  /** Renders a richtext document, resolving embedded blocks via the same component map. */
  StoryblokRichText: ReturnType<typeof createStoryblokRichText>;
}

/**
 * Check if a component is a lazy component (created with React.lazy).
 * Lazy components have $$typeof Symbol(react.lazy).
 *
 * SAFETY: relies on React's internal $$typeof symbol string representation.
 * There is no public API alternative; this pattern is widely used in the
 * ecosystem and has been stable across React 16–19.
 */
function isLazyComponent(component: unknown): boolean {
  if (typeof component !== "object" || component === null) {
    return false;
  }
  const typedComponent = component as { $$typeof?: symbol };
  return typedComponent.$$typeof === Symbol.for("react.lazy");
}

/**
 * Normalize a component entry to extract component and config.
 */
function normalizeEntry(entry: StoryblokComponentEntry): {
  component: BlockComponentType;
  fallback?: SuspenseFallback;
  suspense?: boolean;
} {
  if ("component" in entry) {
    return entry;
  }
  return { component: entry as BlockComponentType };
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
 *       fallback: <WeatherWidgetSkeleton />,
 *       suspense: true,
 *     },
 *   },
 *   fallback: FallbackBlock,
 *   suspenseFallback: <GlobalSkeleton />,
 * });
 * ```
 */
export function defineStoryblokComponents(
  config: StoryblokComponentsOptions,
): StoryblokComponentsResult {
  const defaultSuspenseFallback = config.suspenseFallback ?? null;

  function StoryblokComponent({
    block,
    ...rest
  }: { block: BlockContent | BlockContent[] } & Record<string, unknown>): ReactNode {
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
        <Suspense fallback={fallback ?? defaultSuspenseFallback}>
          <Component block={block} {...rest} />
        </Suspense>
      );
    }

    return <Component block={block} {...rest} />;
  }

  StoryblokComponent.displayName = "StoryblokComponent";

  // Pre-compute once so every access returns the same function reference.
  // A getter would call createStoryblokRichText() on each access, producing a
  // new component type per render and causing React to unmount + remount the
  // entire richtext subtree on every render.
  const StoryblokRichText = createStoryblokRichText(StoryblokComponent as BlockComponentType);

  return {
    StoryblokComponent,
    StoryblokRichText,
  };
}
