import { type ComponentType, type ReactNode, Suspense } from "react";
import { storyblokEditable } from "@storyblok/live-preview";
import type { StoryblokBlockData } from "./types";
import { createStoryblokRichText } from "./richtext/create-storyblok-richtext";

/** Attributes returned by {@link storyblokEditable} — spread onto the root element of a block component. */
type EditableProps = ReturnType<typeof storyblokEditable>;

/** Internal type: how the registry calls components (always passes StoryblokBlockData and editable). */
type BlockComponentType = ComponentType<{ block: StoryblokBlockData; editable?: EditableProps }>;

/**
 * Registration type: accepts any component whose block prop is a subtype of StoryblokBlockData.
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
export type StoryblokBlockEntry =
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

/** Options passed to {@link defineStoryblokBlocks}. */
export interface StoryblokBlocksOptions {
  components: Record<string, StoryblokBlockEntry>;
  /** Fallback component when a block type is not found */
  fallback?: AnyBlockComponent;
  /**
   * Default Suspense fallback for async components (`<GlobalSkeleton />`).
   */
  suspenseFallback?: SuspenseFallback;
}

/** Components returned by {@link defineStoryblokBlocks}, pre-wired to the same component map. */
export interface StoryblokBlocksResult<TExtraProps extends object = {}> {
  /**
   * Renders a single block by looking up `block.component` in the map.
   *
   * `TExtraProps` comes from the type argument passed to
   * {@link defineStoryblokBlocks}, not from this call site, so it forwards
   * extra props to every rendered block component with real excess-property
   * checking: a misspelled prop (`titlee="typo"`) is a compile error instead
   * of silently forwarding. Without a type argument, `TExtraProps` defaults to
   * `{}` and `StoryblokBlock` only accepts `block`.
   *
   * @example
   * ```tsx
   * const { StoryblokBlock } = defineStoryblokBlocks<{ locale: string }>({
   *   components: { page: Page, teaser: Teaser },
   * });
   *
   * <StoryblokBlock block={story.content} />
   * // Extra props declared in TExtraProps are forwarded to every rendered block:
   * <StoryblokBlock block={story.content} locale="en" />
   * // <StoryblokBlock block={story.content} localle="en" /> would be a compile error.
   * ```
   */
  StoryblokBlock: (props: { block: StoryblokBlockData } & TExtraProps) => ReactNode;
  /**
   * Renders an array of blocks, delegating each entry to `StoryblokBlock`.
   *
   * Convenience over mapping manually: `key` is derived from `block._uid`
   * and every entry receives the same `TExtraProps`.
   *
   * @example
   * ```tsx
   * const { StoryblokBlocks } = defineStoryblokBlocks({
   *   components: { page: Page, teaser: Teaser },
   * });
   *
   * <StoryblokBlocks blocks={block.columns} />
   * ```
   */
  StoryblokBlocks: (props: { blocks: StoryblokBlockData[] } & TExtraProps) => ReactNode;
  /** Renders a richtext document, resolving embedded blocks via the same component map. */
  StoryblokRichText: ReturnType<typeof createStoryblokRichText>;
}

/**
 * Check if a component is a lazy component (created with React.lazy).
 * Lazy components have `$$typeof === Symbol.for("react.lazy")`.
 *
 * Unwraps `React.memo` first: `memo(lazy(...))` has its own `$$typeof`
 * (`Symbol.for("react.memo")`) with the lazy component nested under `.type`,
 * so checking the outer value alone would miss it.
 *
 * SAFETY: relies on React's internal `$$typeof` symbols. There is no public
 * API alternative; this pattern is widely used in the ecosystem and has been
 * stable across React 16–19.
 */
function isLazyComponent(component: unknown): boolean {
  const target = unwrapMemo(component);
  if (typeof target !== "object" || target === null) {
    return false;
  }
  const typedComponent = target as { $$typeof?: symbol };
  return typedComponent.$$typeof === Symbol.for("react.lazy");
}

/** Unwraps `React.memo(Component)` to the `Component` it wraps; returns other values unchanged. */
function unwrapMemo(component: unknown): unknown {
  if (typeof component !== "object" || component === null) {
    return component;
  }
  const typedComponent = component as { $$typeof?: symbol; type?: unknown };
  return typedComponent.$$typeof === Symbol.for("react.memo") ? typedComponent.type : component;
}

/**
 * Normalize a component entry to extract component and config.
 */
function normalizeEntry(entry: StoryblokBlockEntry): {
  component: BlockComponentType;
  fallback?: SuspenseFallback;
  suspense?: boolean;
} {
  if ("component" in entry) {
    return entry;
  }
  return { component: entry as BlockComponentType };
}

/** Pre-computed, render-ready descriptor for a single registered block type. */
type ResolvedEntry = {
  Component: BlockComponentType;
  needsSuspense: boolean;
  fallbackNode: ReactNode;
};

/**
 * Maps Storyblok block types to React components and returns pre-wired
 * `StoryblokBlock`, `StoryblokBlocks`, and `StoryblokRichText`.
 *
 * Pass `TExtraProps` as an explicit type argument to type the extra props
 * `StoryblokBlock`/`StoryblokBlocks` forward to every rendered block
 * component, with real excess-property checking on every call site. Without
 * it, they only accept `block`/`blocks`.
 *
 * @example
 * ```tsx
 * export const { StoryblokBlock, StoryblokBlocks, StoryblokRichText } = defineStoryblokBlocks<{
 *   locale: string;
 * }>({
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
export function defineStoryblokBlocks<TExtraProps extends object = {}>(
  config: StoryblokBlocksOptions,
): StoryblokBlocksResult<TExtraProps> {
  const defaultSuspenseFallback = config.suspenseFallback ?? null;

  if (!config.components) {
    throw new Error('[Storyblok] defineStoryblokBlocks: "components" is required.');
  }

  // ── Build the registry once at factory time ────────────────────────────────
  // normalizeEntry, isLazyComponent (Symbol.for allocation), and fallback
  // resolution all run here — never inside the render function.
  const registry = new Map<string, ResolvedEntry>();
  for (const [type, entry] of Object.entries(config.components)) {
    if (entry == null) {
      throw new Error(
        `[Storyblok] defineStoryblokBlocks: components["${type}"] is undefined. Check for ` +
          "a typo, or a circular import that hasn't finished initializing yet.",
      );
    }
    if (
      typeof entry === "object" &&
      !("component" in entry) &&
      ("fallback" in entry || "suspense" in entry)
    ) {
      throw new Error(
        `[Storyblok] defineStoryblokBlocks: components["${type}"] is missing "component".`,
      );
    }
    const { component: Component, fallback, suspense } = normalizeEntry(entry);
    registry.set(type, {
      Component,
      needsSuspense: suspense ?? isLazyComponent(Component),
      fallbackNode: fallback ?? defaultSuspenseFallback,
    });
  }

  function StoryblokBlock({
    block,
    ...rest
  }: { block: StoryblokBlockData } & Record<string, unknown>): ReactNode {
    // ── Null guard ──────────────────────────────────────────────────────────
    if (!block) {
      console.error("[Storyblok] StoryblokBlock: 'block' prop is required.");
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

  StoryblokBlock.displayName = "StoryblokBlock";

  function StoryblokBlocks({
    blocks,
    ...rest
  }: { blocks: StoryblokBlockData[] } & Record<string, unknown>): ReactNode {
    if (!blocks) {
      console.error("[Storyblok] StoryblokBlocks: 'blocks' prop is required.");
      return null;
    }

    return blocks.map((block) => <StoryblokBlock key={block._uid} block={block} {...rest} />);
  }

  StoryblokBlocks.displayName = "StoryblokBlocks";

  // Pre-compute once so every access returns the same function reference.
  // A getter would call createStoryblokRichText() on each access, producing a
  // new component type per render and causing React to unmount + remount the
  // entire richtext subtree on every render.
  const StoryblokRichText = createStoryblokRichText(StoryblokBlock);

  return {
    // Cast: the internal implementation uses `Record<string, unknown>` for JSX
    // spreads onto fixed-type components, which is a safe superset of whatever
    // `TExtraProps` the caller supplied as a type argument to this function.
    StoryblokBlock: StoryblokBlock as StoryblokBlocksResult<TExtraProps>["StoryblokBlock"],
    StoryblokBlocks: StoryblokBlocks as StoryblokBlocksResult<TExtraProps>["StoryblokBlocks"],
    StoryblokRichText,
  };
}
