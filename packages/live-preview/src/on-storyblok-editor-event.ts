import type StoryblokBridge from "@storyblok/preview-bridge";
import type {
  BridgeParams,
  ChangeBridgeEvent,
  PublishedBridgeEvent,
} from "@storyblok/preview-bridge";
import type { Prettify } from "./generated/types/_utils";
import type { Story } from "./generated/types/story";

import { loadStoryblokBridge, preloadStoryblokBridge } from "./load-storyblok-bridge";
import { isBrowser } from "./utils/is-browser";
import { isInEditor } from "./utils/is-in-editor";

/**
 * The story payload delivered by the Visual Editor `input` event.
 *
 * The Preview Bridge streams a story whose full runtime shape is not
 * guaranteed to match the CDN API. Only `id`, `uuid`, and `content` are
 * relied upon here — their types are sourced from the supplied {@link Story}
 * generic — while every other field is left as `unknown` rather than
 * over-promising a fully typed CDN story.
 *
 * @typeParam TStory - The schema-aware {@link Story} to source field types from.
 */
export type LivePreviewStory<TStory extends Story = Story> = Prettify<
  Pick<TStory, "id"> &
    Partial<Pick<TStory, "uuid" | "content">> & {
      [key: string]: unknown;
    }
>;

/** A Visual Editor event after which the page's content is out of date. */
export type StoryblokEditorChangeEvent = ChangeBridgeEvent | PublishedBridgeEvent;

/**
 * Options for {@link onStoryblokEditorEvent}: the Preview Bridge
 * configuration plus handlers for saved or published changes and for
 * Preview Bridge load failures.
 */
export type LivePreviewOptions = BridgeParams & {
  /**
   * Called when the story is saved (`change`) or published (`published`) in
   * the Visual Editor, instead of reloading the page. Use it to refetch data
   * without a full reload, for example with SvelteKit's `invalidateAll()` or
   * Next.js's `router.refresh()`.
   *
   * The bridge is shared by every subscription on the page, so the page is
   * still reloaded unless every active subscription provides `onChange`.
   * Without it, the page reloads.
   */
  onChange?: (event: StoryblokEditorChangeEvent) => void;
  /**
   * Called if the Preview Bridge fails to load, including a later rebuild of
   * the shared bridge that leaves this subscription without one. The
   * subscription is removed before this runs. Not called for a subscription
   * cleaned up while the bridge was still loading. Without it, the error is
   * logged with `console.error`, once per failure however many subscriptions
   * it affects.
   */
  onError?: (error: unknown) => void;
};

// ---------------------------------------------------------------------------
// Broker — one bridge instance per page, shared across all subscribers.
// Relation options are unioned because the editor only supports one bridge
// configuration per page. The Preview Bridge library can't have two
// instances attached at once, so a rebuild always destroys the current
// bridge before constructing its replacement.
// ---------------------------------------------------------------------------

type Subscriber = (story: LivePreviewStory) => void;

/** Receives a bridge build failure; `undefined` means log it with `console.error`. */
type ErrorHandler = ((error: unknown) => void) | undefined;

type ChangeHandler = LivePreviewOptions["onChange"];

type BridgeEntry = {
  bridge?: StoryblokBridge;
  bridgePromise?: Promise<StoryblokBridge>;
  subscribers: Map<symbol, Subscriber>;
  /** Each subscriber's own requested options, kept so they can be dropped on cleanup. */
  subscriberOptions: Map<symbol, BridgeParams>;
  errorHandlers: Map<symbol, ErrorHandler>;
  changeHandlers: Map<symbol, ChangeHandler>;
  /** Subscribers the live bridge was last built (or confirmed) for. The rest are still waiting. */
  settled: Set<symbol>;
  /** The config the live bridge was actually constructed with, or `undefined` if none is live. */
  appliedOptions?: BridgeParams;
  reconciling: boolean;
  /** Keys already warned about, so a persistent conflict warns once, not on every cycle. */
  warnedKeys: Set<string>;
};

let broker: BridgeEntry | undefined;

const scalarOptionKeys = [
  "customParent",
  "resolveLinks",
  "preventClicks",
  "fallbackLang",
] as const satisfies readonly (keyof BridgeParams)[];

function isUnset(value: unknown): value is undefined | null {
  return value === undefined || value === null;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new -- used only for its side effect of throwing on an invalid URL
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function warnOnce(entry: BridgeEntry, key: string, message: string): void {
  if (entry.warnedKeys.has(key)) return;
  entry.warnedKeys.add(key);
  console.warn(message);
}

function normalizeRelations(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((relation) => relation.trim())
      .filter(Boolean);
  }

  return Array.isArray(value)
    ? value.filter((relation): relation is string => typeof relation === "string")
    : [];
}

/**
 * Merges every subscriber's options, first-wins per key, treating
 * `null`/`undefined` as unset. `preventClicks` is the exception: any
 * subscriber requesting `true` wins regardless of order. An unparsable
 * `customParent` is dropped with a warning instead of reaching the bridge
 * constructor, which throws on it.
 *
 * A departed subscriber's contribution drops out of this merge immediately;
 * {@link retractSubscriber} folds that into a rebuild of the live bridge too.
 */
function computeMergedOptions(entry: BridgeEntry): BridgeParams {
  const merged: BridgeParams = {};
  const relations = new Set<string>();
  const optionsList = [...entry.subscriberOptions.values()];

  for (const options of optionsList) {
    for (const relation of normalizeRelations(options.resolveRelations)) {
      relations.add(relation);
    }
  }
  if (relations.size > 0) merged.resolveRelations = [...relations];

  for (const options of optionsList) {
    if (options.initOnlyOnce !== undefined && options.initOnlyOnce !== false) {
      warnOnce(
        entry,
        "initOnlyOnce",
        '[Storyblok] Live preview option "initOnlyOnce" ignored; shared bridges always use false.',
      );
    }

    const preventClicks = options.preventClicks;
    if (preventClicks === true) {
      merged.preventClicks = true;
    } else if (preventClicks === false && merged.preventClicks === undefined) {
      merged.preventClicks = false;
    }
  }

  for (const key of ["customParent", "resolveLinks", "fallbackLang"] as const) {
    for (const options of optionsList) {
      const value = options[key];
      if (isUnset(value)) continue;

      if (key === "customParent" && typeof value === "string" && !isAbsoluteUrl(value)) {
        warnOnce(
          entry,
          "customParent:invalid",
          `[Storyblok] Live preview option "customParent" ignored: "${value}" is not an absolute URL.`,
        );
        continue;
      }

      if (isUnset(merged[key])) {
        merged[key] = value as never;
      } else if (merged[key] !== value) {
        warnOnce(
          entry,
          key,
          `[Storyblok] Conflicting live preview option "${key}" ignored; using the first value.`,
        );
      }
    }
  }

  return merged;
}

function relationSet(options: BridgeParams | undefined): Set<string> {
  return new Set(normalizeRelations(options?.resolveRelations));
}

/** Equality check used instead of a version counter, so an unchanged merge never rebuilds. */
function optionsEqual(a: BridgeParams | undefined, b: BridgeParams | undefined): boolean {
  for (const key of scalarOptionKeys) {
    if ((a?.[key] ?? null) !== (b?.[key] ?? null)) return false;
  }

  const relationsA = relationSet(a);
  const relationsB = relationSet(b);
  if (relationsA.size !== relationsB.size) return false;
  for (const relation of relationsA) {
    if (!relationsB.has(relation)) return false;
  }

  return true;
}

function removeSubscriber(entry: BridgeEntry, token: symbol): boolean {
  const removed = entry.subscribers.delete(token);
  entry.subscriberOptions.delete(token);
  entry.errorHandlers.delete(token);
  entry.changeHandlers.delete(token);
  entry.settled.delete(token);
  return removed;
}

/**
 * Destroys the shared bridge once the last subscriber has left.
 *
 * While a build is in flight the entry stays the page's broker, so a
 * subscriber that joins before the build settles (a React StrictMode or
 * Svelte `$effect` re-run, for example) is folded into that build. A fresh
 * entry would start a second build that could construct a bridge while the
 * first one is still being constructed.
 */
function destroyIfOrphaned(entry: BridgeEntry): void {
  if (entry.subscribers.size > 0) return;

  entry.bridge?.destroy();
  entry.bridge = undefined;
  entry.appliedOptions = undefined;
  entry.settled.clear();
  if (entry.reconciling) return;

  entry.bridgePromise = undefined;
  if (broker === entry) broker = undefined;
}

/** Calls each handler once, and logs the error at most once for subscribers without one. */
function reportError(handlers: ErrorHandler[], error: unknown): void {
  let logged = false;
  for (const handler of handlers) {
    if (!handler) {
      if (!logged) {
        console.error("[Storyblok] Live preview failed to load the Preview Bridge:", error);
        logged = true;
      }
      continue;
    }
    try {
      handler(error);
    } catch (handlerError) {
      console.error("[Storyblok] Live preview onError handler threw:", handlerError);
    }
  }
}

/**
 * Handles a failed build. The subscribers still waiting for a bridge are
 * removed and notified. If none were waiting (a rebuild after a cleanup
 * failed), every subscriber is, since all of them just lost their bridge.
 *
 * Any subscribers that remain had a working bridge, so the build is retried
 * for them without the failed subscribers' options. None of them counts as
 * settled during that retry, so a second failure removes them all, which
 * bounds the retries to one.
 */
function handleBuildFailure(entry: BridgeEntry, error: unknown): void {
  const tokens = [...entry.subscribers.keys()];
  const waiting = tokens.filter((token) => !entry.settled.has(token));
  const failed = waiting.length > 0 ? waiting : tokens;
  const handlers = failed.map((token) => entry.errorHandlers.get(token));

  for (const token of failed) removeSubscriber(entry, token);
  entry.settled.clear();
  entry.bridgePromise = undefined;

  if (entry.subscribers.size === 0) {
    destroyIfOrphaned(entry);
  } else {
    void ensureBridge(entry);
  }

  reportError(handlers, error);
}

/**
 * Retracts one departed subscriber. If it was the last one, the bridge is
 * torn down. Otherwise the retraction is folded into a reconcile step so a
 * departed subscriber's scalar/relation contribution stops applying to the
 * live bridge right away, instead of lingering until some later, unrelated
 * subscribe/unsubscribe happens to trigger a rebuild.
 *
 * Fire-and-forget: cleanup functions stay synchronous. Coalesced by the same
 * reconcile machinery `ensureBridge` uses for subscribes, so a same-tick
 * unmount and one that doesn't net-change the merged options still collapse
 * into at most one rebuild (or zero). A failed rebuild is reported to the
 * remaining subscribers by {@link handleBuildFailure}.
 */
function retractSubscriber(entry: BridgeEntry): void {
  if (entry.subscribers.size === 0) {
    destroyIfOrphaned(entry);
    return;
  }

  void ensureBridge(entry);
}

function attachBridgeEvents(entry: BridgeEntry, bridge: StoryblokBridge): void {
  bridge.on(["input", "change", "published"], (event) => {
    if (!event) return;

    if (event.action === "input" && event.story) {
      const story = event.story as LivePreviewStory;
      for (const subscriber of entry.subscribers.values()) {
        try {
          subscriber(story);
        } catch (error) {
          console.error("[Storyblok] Live preview subscriber threw:", error);
        }
      }
      return;
    }

    if (event.action === "change" || event.action === "published") {
      handleChange(entry, event);
    }
  });
}

/**
 * Reloads the page after a saved or published change, unless every
 * subscriber handles it with `onChange`. A subscriber without one has no
 * other way to get the new content.
 */
function handleChange(entry: BridgeEntry, event: StoryblokEditorChangeEvent): void {
  if (entry.subscribers.size === 0) return;

  const handlers = [...entry.changeHandlers.values()];
  if (!handlers.every((handler) => handler !== undefined)) {
    window.location.reload();
    return;
  }

  for (const handler of handlers) {
    try {
      handler(event);
    } catch (error) {
      console.error("[Storyblok] Live preview onChange handler threw:", error);
    }
  }
}

/** Ends a build whose subscribers all left before it finished. */
function abandonBuild(entry: BridgeEntry): never {
  entry.reconciling = false;
  destroyIfOrphaned(entry);
  throw new Error("[Storyblok] Live preview subscription was removed before the bridge loaded");
}

/**
 * Builds (or rebuilds) the bridge until it matches the merged options.
 *
 * Every state change after an `await` happens in the same synchronous step
 * as the check before it, so a subscribe or cleanup can never slip in
 * between a build settling and the entry recording that outcome.
 */
async function reconcileBridge(entry: BridgeEntry): Promise<StoryblokBridge> {
  try {
    for (;;) {
      if (entry.subscribers.size === 0) abandonBuild(entry);

      if (entry.bridge && optionsEqual(computeMergedOptions(entry), entry.appliedOptions)) {
        break;
      }

      // Preload before re-reading options, so a subscriber that joins while
      // the module is loading is folded into this build instead of the next.
      await preloadStoryblokBridge();

      if (entry.subscribers.size === 0) abandonBuild(entry);

      const desired = computeMergedOptions(entry);
      if (entry.bridge && optionsEqual(desired, entry.appliedOptions)) {
        continue;
      }

      // Destroy before building — two bridges must never be attached at once.
      entry.bridge?.destroy();
      entry.bridge = undefined;
      entry.appliedOptions = undefined;

      const bridge = await loadStoryblokBridge({ ...desired, initOnlyOnce: false });

      if (entry.subscribers.size === 0) {
        bridge.destroy();
        abandonBuild(entry);
      }

      attachBridgeEvents(entry, bridge);
      entry.bridge = bridge;
      entry.appliedOptions = desired;
    }

    if (!entry.bridge) {
      throw new Error("[Storyblok] Live preview bridge was not created");
    }

    entry.reconciling = false;
    entry.settled = new Set(entry.subscribers.keys());
    return entry.bridge;
  } catch (error) {
    // An abandoned build has already reset `reconciling`; nobody is left to notify.
    if (entry.reconciling) {
      entry.reconciling = false;
      handleBuildFailure(entry, error);
    }
    throw error;
  }
}

/**
 * Returns a promise for a bridge that matches every current subscriber's
 * options, starting a build when needed. Build failures are reported through
 * {@link handleBuildFailure}, so the returned promise never needs a handler.
 */
function ensureBridge(entry: BridgeEntry): Promise<StoryblokBridge> {
  if (entry.bridgePromise) {
    if (entry.reconciling) return entry.bridgePromise;
    if (entry.bridge && optionsEqual(computeMergedOptions(entry), entry.appliedOptions)) {
      entry.settled = new Set(entry.subscribers.keys());
      return entry.bridgePromise;
    }
  }

  entry.reconciling = true;
  // Every caller has at least one subscriber, so reconcileBridge can only
  // settle before its first `await` by succeeding, which leaves this
  // assignment correct.
  const bridgePromise = reconcileBridge(entry);
  entry.bridgePromise = bridgePromise;
  bridgePromise.catch(() => {});
  return bridgePromise;
}

function getBroker(): BridgeEntry {
  if (broker) return broker;

  broker = {
    subscribers: new Map(),
    subscriberOptions: new Map(),
    errorHandlers: new Map(),
    changeHandlers: new Map(),
    settled: new Set(),
    reconciling: false,
    warnedKeys: new Set(),
  };
  return broker;
}

/**
 * Registers a subscriber with the broker synchronously and starts the bridge
 * build. Returns its cleanup function, or `undefined` outside the Visual
 * Editor.
 *
 * If a build fails, the broker removes the affected subscribers before
 * calling their `onError`.
 */
function addSubscriber<TStory extends Story>(
  callback: (story: LivePreviewStory<TStory>) => void,
  options: LivePreviewOptions | undefined,
): (() => void) | undefined {
  if (!isBrowser() || !isInEditor(new URL(window.location.href))) {
    return undefined;
  }

  const entry = getBroker();
  const token = Symbol();
  const { onChange, onError, ...bridgeOptions } = options ?? {};
  entry.subscriberOptions.set(token, bridgeOptions);
  entry.errorHandlers.set(token, onError);
  entry.changeHandlers.set(token, onChange);
  entry.subscribers.set(token, (story) => callback(story as LivePreviewStory<TStory>));

  try {
    void ensureBridge(entry);
  } catch (error) {
    removeSubscriber(entry, token);
    destroyIfOrphaned(entry);
    throw error;
  }

  return () => {
    if (!removeSubscriber(entry, token)) return;
    retractSubscriber(entry);
  };
}

/**
 * Registers a callback for Storyblok Visual Editor live preview updates and
 * returns its cleanup function synchronously.
 *
 * The subscription is active as soon as the call returns, and the cleanup
 * function can be called at any time, including while the Preview Bridge is
 * still loading. That makes it fit framework lifecycle APIs that expect a
 * synchronous teardown, such as Svelte `$effect`, React `useEffect`, Vue
 * `watchEffect`, and Angular `DestroyRef.onDestroy`, without guarding against
 * the component being destroyed mid-load.
 *
 * All subscriptions on a page share a single bridge instance. Relation
 * options are unioned; scalar options (`customParent`, `resolveLinks`,
 * `fallbackLang`) use first-wins semantics per key among active
 * subscribers. `preventClicks` is the exception: any active subscriber
 * requesting `true` wins regardless of order. `initOnlyOnce` is always
 * forced to `false`. This avoids duplicate `window.message` listeners and
 * duplicate overlay DOM when multiple components subscribe on the same
 * page.
 *
 * A departed subscriber's contribution stops being merged in immediately,
 * and cleanup itself triggers a rebuild if that changes the merged options,
 * so its `preventClicks`/relation/scalar contribution stops applying to the
 * live bridge right away rather than lingering until some unrelated future
 * subscribe/unsubscribe. Any change that triggers a rebuild — subscribe,
 * unsubscribe, or a later subscriber changing its options — briefly leaves
 * the page with no attached bridge. Subscriptions (and unsubscriptions) made
 * in the same synchronous tick, or that arrive while the bridge module is
 * still loading, share a single build instead.
 *
 * Preview Bridge load failures are reported through `options.onError`
 * (`console.error` by default) instead of being thrown. That includes a later
 * rebuild of the shared bridge that leaves this subscriber without a bridge;
 * the subscriber is removed before `onError` runs.
 *
 * Outside the Visual Editor (or on the server), the call is a no-op and
 * returns a cleanup function that does nothing.
 *
 * Behavior:
 * - **input** → Calls the provided callback with the updated story data.
 * - **change** → Reloads the page, or calls `onChange` (see {@link LivePreviewOptions}).
 * - **published** → Reloads the page, or calls `onChange`.
 *
 * @typeParam TStory - The schema-aware {@link Story} type to type the payload against.
 *
 * @param callback
 * Callback executed when the Visual Editor sends an `input` event.
 *
 * @param options
 * Optional configuration forwarded to the Preview Bridge constructor, plus
 * an `onChange` handler that replaces the page reload and an `onError`
 * handler for Preview Bridge load failures.
 *
 * @returns
 * A cleanup function that removes this subscriber. When it is the last
 * subscriber the bridge is also destroyed, removing all
 * event listeners and DOM. Call it when the subscribing component is
 * destroyed to prevent stale updates and memory leaks.
 *
 * @example
 * ```ts
 * const cleanup = onStoryblokEditorEvent((story) => {
 *   console.log('Live updated story:', story)
 * }, { resolveRelations: ['featured.articles'] })
 *
 * // later — e.g. component teardown
 * cleanup()
 * ```
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   // Assigning to `$derived` state requires Svelte 5.25 or later.
 *   let { data } = $props();
 *   let story = $derived(data.story);
 *   $effect(() => onStoryblokEditorEvent((newStory) => (story = newStory)));
 * </script>
 * ```
 *
 * @example
 * ```tsx
 * useEffect(
 *   () => onStoryblokEditorEvent(setStory, { resolveRelations: ['featured.articles'] }),
 *   [],
 * );
 * ```
 */
export function onStoryblokEditorEvent<TStory extends Story = Story>(
  callback: (story: LivePreviewStory<TStory>) => void,
  options?: LivePreviewOptions,
): () => void {
  try {
    return addSubscriber(callback, options) ?? (() => {});
  } catch (error) {
    reportError([options?.onError], error);
    return () => {};
  }
}
