import { type ComponentType, type ReactNode, Suspense } from "react";
import { storyblokEditable } from "@storyblok/live-preview";
import type { BlockContent } from "./types";
import { createStoryblokRichText } from "./richtext/create-storyblok-richtext";

/** Attributes returned by {@link storyblokEditable} — spread onto the root element of a block component. */
type EditableProps = ReturnType<typeof storyblokEditable>;

/** Internal type: how the registry calls components (always passes BlockContent and editable). */
type BlockComponentType = ComponentType<{ block: BlockContent; editable?: EditableProps }>;

/**
 * Registration type: accepts any component whose block prop is a subtype of BlockContent.
 * Using `any` intentionally avoids contravariance errors for components with specific block shapes.
 * `editable` is optional so existing components that don't declare it remain assignable.
 */
type AnyBlockComponent = ComponentType<{ block: any; editable?: EditableProps }>;

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
   * `TExtraProps` lets callers thread additional props through the tree without
   * widening the type to `Record<string, unknown>`, which would disable excess
   * property checking and break autocomplete across the board.
   *
   * @example
   * ```tsx
   * <StoryblokComponent block={story.content} />
   * <StoryblokComponent block={story.content.body} />
   * // Extra props are forwarded to every rendered block component:
   * <StoryblokComponent block={story.content} locale="en" />
   * ```
   */
  StoryblokComponent: <TExtraProps extends object = {}>(
    props: { block: BlockContent | BlockContent[] } & TExtraProps,
  ) => ReactNode;
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
/** Pre-computed, render-ready descriptor for a single registered block type. */
type ResolvedEntry = {
  Component: BlockComponentType;
  needsSuspense: boolean;
  fallbackNode: ReactNode;
};

export function defineStoryblokComponents(
  config: StoryblokComponentsOptions,
): StoryblokComponentsResult {
  const defaultSuspenseFallback = config.suspenseFallback ?? null;

  // ── Build the registry once at factory time ────────────────────────────────
  // normalizeEntry, isLazyComponent (Symbol.for allocation), and fallback
  // resolution all run here — never inside the render function.
  const registry = new Map<string, ResolvedEntry>();
  for (const [type, entry] of Object.entries(config.components)) {
    const { component: Component, fallback, suspense } = normalizeEntry(entry);
    registry.set(type, {
      Component,
      needsSuspense: suspense ?? isLazyComponent(Component),
      fallbackNode: fallback ?? defaultSuspenseFallback,
    });
  }

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

    // ── Single block path — O(1) Map.get + one branch ───────────────────────
    const resolved = registry.get(block.component);
    const editable = storyblokEditable(block);

    if (!resolved) {
      if (config.fallback) {
        const FallbackComponent = config.fallback;
        return <FallbackComponent block={block} editable={editable} {...rest} />;
      }
      console.warn(`[Storyblok] No component registered for "${block.component}".`);
      return null;
    }

    const { Component, needsSuspense, fallbackNode } = resolved;

    if (needsSuspense) {
      return (
        <Suspense fallback={fallbackNode}>
          <Component block={block} editable={editable} {...rest} />
        </Suspense>
      );
    }

    return <Component block={block} editable={editable} {...rest} />;
  }

  StoryblokComponent.displayName = "StoryblokComponent";

  // Pre-compute once so every access returns the same function reference.
  // A getter would call createStoryblokRichText() on each access, producing a
  // new component type per render and causing React to unmount + remount the
  // entire richtext subtree on every render.
  const StoryblokRichText = createStoryblokRichText(StoryblokComponent);

  return {
    // Cast: the internal implementation uses `Record<string, unknown>` for JSX
    // spreads onto fixed-type components, which is a safe superset of any
    // `TExtraProps extends object` a caller may infer or supply.
    StoryblokComponent: StoryblokComponent as StoryblokComponentsResult["StoryblokComponent"],
    StoryblokRichText,
  };
}
