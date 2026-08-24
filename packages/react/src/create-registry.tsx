import { type ComponentType, type ReactNode, Suspense } from "react";
import type { BlockContent } from "@storyblok/live-preview";
import { createStoryblokRichText } from "./richtext/create-storyblok-richtext";

// ─── Internal types ───────────────────────────────────────────────────────────

/**
 * How the registry calls components internally — always passes a single BlockContent.
 */
type AnyBlockComponent = ComponentType<{ block: any }>;

function isLazyComponent(component: unknown): boolean {
  const c = component as { $$typeof?: symbol } | null;
  return (
    typeof c === "object" &&
    c !== null &&
    typeof c.$$typeof === "symbol" &&
    c.$$typeof.toString() === "Symbol(react.lazy)"
  );
}

function normalizeEntry(entry: ComponentEntry): {
  component: AnyBlockComponent;
  fallback?: ReactNode;
  suspense?: boolean;
} {
  if (typeof entry === "function" || isLazyComponent(entry)) {
    return { component: entry as AnyBlockComponent };
  }
  return entry;
}

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * A component entry in the registry. Either a plain component or a config
 * object that enables an automatic Suspense boundary with a fallback.
 *
 * @example Plain component
 * ```tsx
 * createRegistry({ components: { teaser: Teaser } })
 * ```
 *
 * @example Async component with Suspense
 * ```tsx
 * createRegistry({
 *   components: {
 *     weather_widget: {
 *       component: WeatherWidget,
 *       fallback: <WeatherWidgetSkeleton />,
 *       suspense: true,
 *     },
 *   },
 * })
 * ```
 */
export type ComponentEntry =
  | AnyBlockComponent
  | {
      component: AnyBlockComponent;
      /** Rendered while the component is loading. Required when suspense is true. */
      fallback?: ReactNode;
      /** Wrap this component in a Suspense boundary. Auto-detected for React.lazy components. */
      suspense?: boolean;
    };

export interface RegistryOptions {
  /** Map of Storyblok component names to React components. */
  components: Record<string, ComponentEntry>;
  /** Rendered when a block type has no matching entry in the registry. */
  fallback?: AnyBlockComponent;
  /** Default Suspense fallback used when a suspense entry omits its own fallback. */
  suspenseFallback?: ReactNode;
}

export interface RegistryResult {
  /**
   * Renders a single block or an array of blocks by looking up each block's
   * `component` field in the registry.
   *
   * @example Single block
   * ```tsx
   * <StoryblokComponent block={story.content} />
   * ```
   *
   * @example Array of blocks
   * ```tsx
   * <StoryblokComponent block={story.content.body} />
   * ```
   */
  StoryblokComponent: ComponentType<
    { block: BlockContent | BlockContent[] } & Record<string, unknown>
  >;
  /**
   * Renders a Storyblok rich-text document. Embedded blocks are rendered via
   * StoryblokComponent, so they resolve against the same registry.
   */
  StoryblokRichText: ReturnType<typeof createStoryblokRichText>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a component registry bound to the provided component map.
 *
 * Returns `StoryblokComponent` and `StoryblokRichText` — both pre-wired to the
 * same registry so embedded blocks in rich text resolve correctly without any
 * manual wiring.
 *
 * `StoryblokComponent` accepts either a single block or an array of blocks via
 * the same `block` prop — no separate list component needed.
 *
 * @example
 * ```tsx
 * // app/lib/storyblok.ts
 * export const { StoryblokComponent, StoryblokRichText } = createRegistry({
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
 * });
 * ```
 */
export function createRegistry({
  components,
  fallback: Fallback,
  suspenseFallback = null,
}: RegistryOptions): RegistryResult {
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

    // ── Single block path ───────────────────────────────────────────────────
    if (!block) {
      console.error("[Storyblok] StoryblokComponent: 'block' prop is required.");
      return null;
    }

    const entry = components[block.component];

    if (!entry) {
      if (Fallback) {
        return <Fallback block={block} {...rest} />;
      }
      console.warn(`[Storyblok] No component registered for "${block.component}".`);
      return null;
    }

    const { component: Comp, fallback, suspense } = normalizeEntry(entry);
    const needsSuspense = suspense ?? isLazyComponent(Comp);

    if (needsSuspense) {
      return (
        <Suspense fallback={fallback ?? suspenseFallback}>
          <Comp block={block} {...rest} />
        </Suspense>
      );
    }

    return <Comp block={block} {...rest} />;
  }

  StoryblokComponent.displayName = "StoryblokComponent";

  const StoryblokRichText = createStoryblokRichText(
    StoryblokComponent as ComponentType<{ block: BlockContent }>,
  );

  return { StoryblokComponent, StoryblokRichText };
}
