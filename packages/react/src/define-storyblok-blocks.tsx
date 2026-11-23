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

/**
 * Check if a value is something React can render as a component: a function
 * (function or class component, including RSC client references, which are
 * functions), or an exotic component object created by `memo`, `forwardRef`,
 * or `lazy`, or a client module proxy.
 *
 * Catches the common registration mistakes before React does: a module
 * namespace (`import * as Page`), `{ default: Page }`, or `undefined` from a
 * typo or an unfinished import cycle. React would otherwise fail with an
 * "Element type is invalid" error that doesn't name the block type.
 *
 * SAFETY: relies on the same internal `$$typeof` symbols as
 * {@link isLazyComponent}.
 */
function isValidReactComponent(component: unknown): boolean {
  if (typeof component === "function") {
    return true;
  }
  if (typeof component !== "object" || component === null) {
    return false;
  }
  return COMPONENT_TYPEOFS.has(Reflect.get(component, "$$typeof"));
}

const COMPONENT_TYPEOFS: ReadonlySet<unknown> = new Set([
  Symbol.for("react.memo"),
  Symbol.for("react.forward_ref"),
  Symbol.for("react.lazy"),
  Symbol.for("react.client.reference"),
]);

const NOT_A_COMPONENT_HINT =
  "Register the component itself, not its module namespace (`import * as`) or " +
  "`{ default: Component }`.";

const UNSET_HINT = "Check for a typo, or a circular import that hasn't finished initializing yet.";

/** Pre-computed, render-ready descriptor for a single registered block type. */
type ResolvedEntry = {
  // `any` so the registry doesn't care which extra props the components take:
  // `defineStoryblokBlocks()` already checked them.
  Component: StoryblokBlockComponent<any>;
  needsSuspense: boolean;
  fallbackNode: ReactNode;
};

/** Registry built from the factory's options. */
type ResolvedRegistry = {
  /** Valid entries only. */
  entries: Map<string, ResolvedEntry>;
  /** Warning message for each registered block type whose entry can't render. */
  invalid: Map<string, string>;
  /** The `fallback`, or `undefined` when it's absent or can't render. */
  fallback?: StoryblokBlockComponent<any>;
  /** Whether a `fallback` was passed that can't render. */
  invalidFallback: boolean;
  warnings: boolean;
};

/** Props `StoryblokBlock` is called with at runtime: the block plus any extra props. */
type RuntimeBlockProps = { block?: StoryblokBlockData } & Record<string, unknown>;

/**
 * Validates a registered entry and normalizes it to a render-ready
 * descriptor. Returns the warning message for an entry that can't render.
 */
function resolveEntry(
  type: string,
  entry: StoryblokBlockEntry<any> | undefined,
  defaultSuspenseFallback: ReactNode,
): ResolvedEntry | string {
  const prefix = `[storyblok] defineStoryblokBlocks: components["${type}"]`;
  if (entry == null) {
    // The factory defers reading `components` to first render, which
    // closes the ordinary import-cycle hazard (see
    // circular-import-fixtures/circular-import.test.tsx). This fires for a
    // genuine typo or an explicit `undefined`.
    return `${prefix} is undefined. ${UNSET_HINT}`;
  }
  if (typeof entry === "object" && "component" in entry) {
    // Same hazard as the `entry == null` check above, one level down.
    if (entry.component == null) {
      return `${prefix}.component is undefined. ${UNSET_HINT}`;
    }
    if (!isValidReactComponent(entry.component)) {
      return `${prefix}.component isn't a valid React component. ${NOT_A_COMPONENT_HINT}`;
    }
    return {
      Component: entry.component,
      needsSuspense: entry.suspense ?? isLazyComponent(entry.component),
      fallbackNode: entry.fallback ?? defaultSuspenseFallback,
    };
  }
  if (typeof entry === "object" && ("fallback" in entry || "suspense" in entry)) {
    return `${prefix} is missing "component".`;
  }
  if (!isValidReactComponent(entry)) {
    return `${prefix} isn't a valid React component. ${NOT_A_COMPONENT_HINT}`;
  }
  return {
    Component: entry,
    needsSuspense: isLazyComponent(entry),
    fallbackNode: defaultSuspenseFallback,
  };
}

/**
 * Maps Storyblok block types to React components and returns a pre-wired
 * `StoryblokBlock`.
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
 * export const { StoryblokBlock } = defineStoryblokBlocks<{
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
  // Cached once a build comes back fully valid, so the factory runs once no
  // matter how many blocks render. A build that throws (the factory itself)
  // or has an invalid entry or `fallback` is not cached: the next render
  // calls the factory again, so a binding that was still unset mid-cycle
  // resolves once it's assigned. A factory with side effects may therefore
  // run more than once until it returns a valid registry.
  let resolved: ResolvedRegistry | undefined;
  // Warnings already printed, so re-renders (and a server rendering the same
  // page on every request) don't repeat the same warning.
  const warned = new Set<string>();

  // ── Build the registry lazily, on first render ──────────────────────────
  // Entry validation and normalization run here, never at module-init time,
  // which is what makes the import-cycle case above resolve correctly. An
  // invalid entry only affects blocks of its own type: they warn and use the
  // `fallback`, like a block type that isn't registered at all.
  function resolveRegistry(): ResolvedRegistry {
    if (resolved) {
      return resolved;
    }

    const { components = {}, fallback, suspenseFallback = null, warnings = true } = factory();
    const entries = new Map<string, ResolvedEntry>();
    const invalid = new Map<string, string>();
    for (const [type, entry] of Object.entries(components)) {
      const result = resolveEntry(type, entry, suspenseFallback);
      if (typeof result === "string") {
        invalid.set(type, result);
      } else {
        entries.set(type, result);
      }
    }
    // Held to the same bar as a registered component.
    const invalidFallback = fallback != null && !isValidReactComponent(fallback);

    const registry: ResolvedRegistry = {
      entries,
      invalid,
      fallback: invalidFallback ? undefined : fallback,
      invalidFallback,
      warnings,
    };
    if (invalid.size === 0 && !invalidFallback) {
      resolved = registry;
    }
    return registry;
  }

  /** Logs `message` once per `key`, unless the registry was defined with `warnings: false`. */
  function warn(key: string, message: string, warnings: boolean): void {
    if (!warnings || warned.has(key)) {
      return;
    }
    warned.add(key);
    console.warn(message);
  }

  /**
   * Reads the `warnings` option for a render that returns `null` regardless.
   * A factory that throws must not turn that render into a throw: the error
   * isn't cached, so it still surfaces on the next render that needs a
   * component. Until then, warn, as the default does.
   */
  function warningsEnabled(): boolean {
    try {
      return resolveRegistry().warnings;
    } catch {
      return true;
    }
  }

  function StoryblokBlock({ block, ...rest }: RuntimeBlockProps): ReactNode {
    if (!block) {
      // Skipped in the Visual Editor, where the bridge sends a story without
      // `content` while the editor shows a previous version (visual history).
      const inEditor = typeof window !== "undefined" && isInEditor(new URL(window.location.href));
      if (!inEditor && !warned.has("undefined-block")) {
        warn(
          "undefined-block",
          "[storyblok] <StoryblokBlock /> received an undefined `block` prop and rendered nothing. " +
            "Check that the value you're passing in exists, e.g. `story?.content` when the fetch " +
            "may have failed, or a typo in the prop name (`block`, not `blok`).",
          warningsEnabled(),
        );
      }
      return null;
    }

    const { entries, invalid, fallback, invalidFallback, warnings } = resolveRegistry();
    const resolvedEntry = entries.get(block.component);
    const editable = storyblokEditable(block);

    // `rest` first in every branch, so an untyped extra prop can't replace
    // the injected `block` or `editable`.
    if (!resolvedEntry) {
      const invalidMessage = invalid.get(block.component);
      if (invalidMessage !== undefined) {
        warn(`invalid:${block.component}`, invalidMessage, warnings);
      }
      if (fallback) {
        const FallbackComponent = fallback;
        return <FallbackComponent {...rest} block={block} editable={editable} />;
      }
      if (invalidFallback) {
        warn(
          "invalid-fallback",
          "[storyblok] defineStoryblokBlocks: `fallback` isn't a valid React component. " +
            NOT_A_COMPONENT_HINT,
          warnings,
        );
        return null;
      }
      // Content editors can add block types the code doesn't know about, so
      // this warns by default: otherwise the content silently goes missing.
      // An invalid entry already warned above, with the actual cause.
      if (invalidMessage === undefined) {
        warn(
          `missing:${block.component}`,
          `[storyblok] No component registered for block type "${block.component}". ` +
            "Register it in `defineStoryblokBlocks(() => ({ components }))` or provide a `fallback`.",
          warnings,
        );
      }
      return null;
    }

    const { Component, needsSuspense, fallbackNode } = resolvedEntry;
    const element = <Component {...rest} block={block} editable={editable} />;
    return needsSuspense ? <Suspense fallback={fallbackNode}>{element}</Suspense> : element;
  }

  StoryblokBlock.displayName = "StoryblokBlock";

  // No cast needed: `RuntimeBlockProps` accepts any extra props, which is a
  // superset of whatever `TExtraProps` the caller supplied.
  return { StoryblokBlock };
}
