import { type ReactNode, Suspense } from "react";
import { isInEditor, storyblokEditable } from "@storyblok/live-preview";
import type {
  DefineStoryblokBlocksOptions,
  DefineStoryblokBlocksResult,
  StoryblokBlockComponent,
  StoryblokBlockData,
  StoryblokBlockEntry,
  StoryblokExtraProps,
} from "./types";
import { createStoryblokRichText } from "./richtext/create-storyblok-richtext";

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
  return Reflect.get(target, "$$typeof") === Symbol.for("react.lazy");
}

/** Unwraps `React.memo(Component)` to the `Component` it wraps; returns other values unchanged. */
function unwrapMemo(component: unknown): unknown {
  if (typeof component !== "object" || component === null) {
    return component;
  }
  return Reflect.get(component, "$$typeof") === Symbol.for("react.memo")
    ? Reflect.get(component, "type")
    : component;
}

/** Pre-computed, render-ready descriptor for a single registered block type. */
type ResolvedEntry = {
  // `any` so the registry doesn't care which extra props the components take:
  // `defineStoryblokBlocks()` already checked them.
  Component: StoryblokBlockComponent<any>;
  needsSuspense: boolean;
  fallbackNode: ReactNode;
};

/** Registry built from the factory's options, cached after the first render. */
type ResolvedRegistry = {
  entries: Map<string, ResolvedEntry>;
  fallback?: StoryblokBlockComponent<any>;
  warnings: boolean;
};

/** Props `StoryblokBlock` is called with at runtime: the block plus any extra props. */
type RuntimeBlockProps = { block?: StoryblokBlockData } & Record<string, unknown>;

/**
 * Validates a registered entry and normalizes it to a render-ready
 * descriptor. Throws for an entry that can't render.
 */
function resolveEntry(
  type: string,
  entry: StoryblokBlockEntry<any> | undefined,
  defaultSuspenseFallback: ReactNode,
): ResolvedEntry {
  if (entry == null) {
    // The factory defers reading `components` to first render, which
    // closes the ordinary import-cycle hazard (see
    // circular-import-fixtures/circular-import.test.tsx). This still
    // fires for a genuine typo, or if something calls StoryblokBlock as
    // a plain function during module evaluation instead of through
    // React's render — see circular-import-fixtures/eager-call.test.tsx.
    throw new Error(
      `[storyblok] defineStoryblokBlocks: components["${type}"] is undefined. Check for ` +
        "a typo, or a circular import that hasn't finished initializing yet.",
    );
  }
  if (typeof entry === "object" && "component" in entry) {
    return {
      Component: entry.component,
      needsSuspense: entry.suspense ?? isLazyComponent(entry.component),
      fallbackNode: entry.fallback ?? defaultSuspenseFallback,
    };
  }
  if (typeof entry === "object" && ("fallback" in entry || "suspense" in entry)) {
    throw new Error(
      `[storyblok] defineStoryblokBlocks: components["${type}"] is missing "component".`,
    );
  }
  return {
    Component: entry,
    needsSuspense: isLazyComponent(entry),
    fallbackNode: defaultSuspenseFallback,
  };
}

/**
 * Maps Storyblok block types to React components and returns pre-wired
 * `StoryblokBlock` and `StoryblokRichText`.
 *
 * Each call is fully independent: nothing is shared globally, so you can
 * define as many registries as you like (e.g. one per content area) without
 * them overwriting each other.
 *
 * Pass `TExtraProps` as an explicit type argument to type the extra props
 * `StoryblokBlock` forwards to every rendered block component, with real
 * excess-property checking on every call site. Without it, it only accepts
 * `block`. `block` and `editable` are reserved: `StoryblokBlock` injects them.
 *
 * Takes a factory rather than the options object directly: block components
 * often import `StoryblokBlock` back from this same registry (to recurse
 * into `body` fields), making this an import cycle. A factory defers
 * reading `components` until the first render, by which point the cycle has
 * finished initializing, instead of capturing a component binding before
 * it's assigned.
 *
 * @example
 * ```tsx
 * export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks<{
 *   locale: string;
 * }>(() => ({
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
 *   warnings: true, // default: log when a block renders nothing
 * }));
 * ```
 */
export function defineStoryblokBlocks<TExtraProps extends StoryblokExtraProps = {}>(
  // `NoInfer` makes `TExtraProps` come from the type argument only. Inferred
  // from the registered components, it would accept any of them.
  factory: () => DefineStoryblokBlocksOptions<NoInfer<TExtraProps>>,
): DefineStoryblokBlocksResult<TExtraProps> {
  // Cached after the first call so a factory with side effects only ever
  // runs once, no matter how many blocks render.
  let resolved: ResolvedRegistry | undefined;
  // Warnings already printed, so re-renders (and a server rendering the same
  // page on every request) don't repeat the same warning.
  const warned = new Set<string>();

  // ── Build the registry lazily, on first render ──────────────────────────
  // Entry normalization, isLazyComponent (Symbol.for allocation), and
  // fallback resolution all run here — never more than once, and never at
  // module-init time, which is what makes the import-cycle case above
  // resolve correctly.
  function resolveRegistry(): ResolvedRegistry {
    if (resolved) {
      return resolved;
    }

    const { components = {}, fallback, suspenseFallback = null, warnings = true } = factory();
    const entries = new Map<string, ResolvedEntry>();
    for (const [type, entry] of Object.entries(components)) {
      entries.set(type, resolveEntry(type, entry, suspenseFallback));
    }

    resolved = { entries, fallback, warnings };
    return resolved;
  }

  /** Logs `message` once per `key`, unless the registry was defined with `warnings: false`. */
  function warn(key: string, message: string): void {
    if (!resolveRegistry().warnings || warned.has(key)) {
      return;
    }
    warned.add(key);
    console.warn(message);
  }

  function renderBlock({ block, ...rest }: RuntimeBlockProps, silent: boolean): ReactNode {
    if (!block) {
      // Skipped in the Visual Editor, where the bridge sends a story without
      // `content` while the editor shows a previous version (visual history).
      const inEditor = typeof window !== "undefined" && isInEditor(new URL(window.location.href));
      if (!silent && !inEditor) {
        warn(
          "undefined-block",
          "[storyblok] <StoryblokBlock /> received an undefined `block` prop and rendered nothing. " +
            "Check that the value you're passing in exists, e.g. `story?.content` when the fetch " +
            "may have failed, or a typo in the prop name (`block`, not `blok`).",
        );
      }
      return null;
    }

    const { entries, fallback } = resolveRegistry();
    const resolvedEntry = entries.get(block.component);
    const editable = storyblokEditable(block);

    // `rest` first in every branch, so an untyped extra prop (e.g. from rich
    // text `data`) can't replace the injected `block` or `editable`.
    if (!resolvedEntry) {
      if (fallback) {
        const FallbackComponent = fallback;
        return <FallbackComponent {...rest} block={block} editable={editable} />;
      }
      // Content editors can add block types the code doesn't know about, so
      // this warns by default: otherwise the content silently goes missing.
      if (!silent) {
        warn(
          `missing:${block.component}`,
          `[storyblok] No component registered for block type "${block.component}". ` +
            "Register it in `defineStoryblokBlocks(() => ({ components }))` or provide a `fallback`.",
        );
      }
      return null;
    }

    const { Component, needsSuspense, fallbackNode } = resolvedEntry;
    const element = <Component {...rest} block={block} editable={editable} />;
    return needsSuspense ? <Suspense fallback={fallbackNode}>{element}</Suspense> : element;
  }

  function StoryblokBlock(props: RuntimeBlockProps): ReactNode {
    return renderBlock(props, false);
  }
  StoryblokBlock.displayName = "StoryblokBlock";

  function SilentStoryblokBlock(props: RuntimeBlockProps): ReactNode {
    return renderBlock(props, true);
  }
  SilentStoryblokBlock.displayName = "StoryblokBlock";

  // Pre-computed once so every access returns the same function reference.
  // A getter would call createStoryblokRichText() on each access, producing a
  // new component type per render and causing React to unmount + remount the
  // entire richtext subtree on every render.
  const StoryblokRichText = createStoryblokRichText({ StoryblokBlock, SilentStoryblokBlock });

  // No cast needed: `RuntimeBlockProps` accepts any extra props, which is a
  // superset of whatever `TExtraProps` the caller supplied.
  return { StoryblokBlock, StoryblokRichText };
}
