import type StoryblokBridge from "@storyblok/preview-bridge";
import type { BridgeParams } from "@storyblok/preview-bridge";
import type { Prettify } from "./generated/types/_utils";
import type { Story } from "./generated/types/story";

import { loadStoryblokBridge, preloadStoryblokBridge } from "./loadStoryblokBridge";
import { isBrowser } from "./utils/isBrowser";
import { isInEditor } from "./utils/isInEditor";

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

// ---------------------------------------------------------------------------
// Broker — one bridge instance per page, shared across all subscribers.
// Relation options are unioned because the editor only supports one bridge
// configuration per page. The Preview Bridge library can't have two
// instances attached at once, so a rebuild always destroys the current
// bridge before constructing its replacement.
// ---------------------------------------------------------------------------

type Subscriber = (story: LivePreviewStory) => void;

type BridgeEntry = {
  bridge?: StoryblokBridge;
  bridgePromise?: Promise<StoryblokBridge>;
  subscribers: Map<symbol, Subscriber>;
  /** Each subscriber's own requested options, kept so they can be dropped on cleanup. */
  subscriberOptions: Map<symbol, BridgeParams>;
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

/** Destroys the shared bridge once the last subscriber has left. */
function destroyIfOrphaned(entry: BridgeEntry): void {
  if (entry.subscribers.size > 0) return;

  if (broker === entry) broker = undefined;
  entry.bridge?.destroy();
  entry.bridge = undefined;
  entry.appliedOptions = undefined;
}

/**
 * Retracts one departed subscriber. If it was the last one, the bridge is
 * torn down. Otherwise the retraction is folded into a reconcile step so a
 * departed subscriber's scalar/relation contribution stops applying to the
 * live bridge right away, instead of lingering until some later, unrelated
 * subscribe/unsubscribe happens to trigger a rebuild.
 *
 * Fire-and-forget: cleanup functions stay synchronous, matching the existing
 * contract. Coalesced by the same reconcile machinery `ensureBridge` uses for
 * subscribes, so a same-tick unmount and one that doesn't net-change the
 * merged options still collapse into at most one rebuild (or zero).
 */
function retractSubscriber(entry: BridgeEntry): void {
  if (entry.subscribers.size === 0) {
    destroyIfOrphaned(entry);
    return;
  }

  void ensureBridge(entry).catch((error: unknown) => {
    // A subsequent cleanup in the same synchronous batch may have already
    // torn the whole entry down (subscribers.size === 0) by the time this
    // settles — that's an expected race, not a failure worth surfacing.
    if (entry.subscribers.size === 0) return;
    console.error("[Storyblok] Live preview bridge rebuild after cleanup failed:", error);
  });
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

    if ((event.action === "change" || event.action === "published") && entry.subscribers.size > 0) {
      window.location.reload();
    }
  });
}

async function reconcileBridge(entry: BridgeEntry): Promise<StoryblokBridge> {
  for (;;) {
    if (broker !== entry || entry.subscribers.size === 0) {
      throw new Error("[Storyblok] Live preview subscription was removed before the bridge loaded");
    }

    if (entry.bridge && optionsEqual(computeMergedOptions(entry), entry.appliedOptions)) {
      break;
    }

    // Preload before re-reading options, so a subscriber that joins while
    // the module is loading is folded into this build instead of the next.
    await preloadStoryblokBridge();

    if (broker !== entry || entry.subscribers.size === 0) {
      throw new Error("[Storyblok] Live preview subscription was removed while the bridge loaded");
    }

    const desired = computeMergedOptions(entry);
    if (entry.bridge && optionsEqual(desired, entry.appliedOptions)) {
      continue;
    }

    // Destroy before building — two bridges must never be attached at once.
    entry.bridge?.destroy();
    entry.bridge = undefined;
    entry.appliedOptions = undefined;

    const bridge = await loadStoryblokBridge({ ...desired, initOnlyOnce: false });

    if (broker !== entry || entry.subscribers.size === 0) {
      bridge.destroy();
      throw new Error("[Storyblok] Live preview subscription was removed while the bridge loaded");
    }

    attachBridgeEvents(entry, bridge);
    entry.bridge = bridge;
    entry.appliedOptions = desired;
  }

  if (!entry.bridge) {
    throw new Error("[Storyblok] Live preview bridge was not created");
  }

  entry.reconciling = false;
  return entry.bridge;
}

function ensureBridge(entry: BridgeEntry): Promise<StoryblokBridge> {
  if (
    entry.bridgePromise &&
    (entry.reconciling || optionsEqual(computeMergedOptions(entry), entry.appliedOptions))
  ) {
    return entry.bridgePromise;
  }

  entry.reconciling = true;
  const bridgePromise = reconcileBridge(entry);
  entry.bridgePromise = bridgePromise;

  void bridgePromise.then(
    () => {
      if (entry.bridgePromise === bridgePromise) entry.reconciling = false;
    },
    () => {
      if (entry.bridgePromise !== bridgePromise) return;

      entry.reconciling = false;
      if (entry.bridge) {
        entry.bridgePromise = Promise.resolve(entry.bridge);
      } else if (broker === entry) {
        broker = undefined;
      }
    },
  );

  return bridgePromise;
}

function getBroker(): BridgeEntry {
  if (broker) return broker;

  broker = {
    subscribers: new Map(),
    subscriberOptions: new Map(),
    reconciling: false,
    warnedKeys: new Set(),
  };
  return broker;
}

/**
 * Registers a callback for Storyblok Visual Editor live preview updates.
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
 * Behavior:
 * - **input** → Calls the provided callback with the updated story data.
 * - **change** → Reloads the page.
 * - **published** → Reloads the page.
 *
 * @typeParam TStory - The schema-aware {@link Story} type to type the payload against.
 *
 * @param callback
 * Callback executed when the Visual Editor sends an `input` event.
 *
 * @param bridgeOptions
 * Optional configuration forwarded to the Preview Bridge constructor.
 *
 * @returns
 * A cleanup function that removes this subscriber. When it is the last
 * subscriber the bridge is also destroyed, removing all
 * event listeners and DOM. Call it when the subscribing component is
 * destroyed to prevent stale updates and memory leaks.
 *
 * @example
 * ```ts
 * const cleanup = await onStoryblokEditorEvent((story) => {
 *   console.log('Live updated story:', story)
 * }, { resolveRelations: ['featured.articles'] })
 *
 * // later — e.g. component teardown
 * cleanup()
 * ```
 */
export async function onStoryblokEditorEvent<TStory extends Story = Story>(
  callback: (story: LivePreviewStory<TStory>) => void,
  bridgeOptions?: BridgeParams,
): Promise<() => void> {
  if (!isBrowser() || !isInEditor(new URL(window.location.href))) {
    return () => {};
  }

  const entry = getBroker();
  const token = Symbol();
  entry.subscriberOptions.set(token, bridgeOptions ?? {});
  const subscriber: Subscriber = (story) => callback(story as LivePreviewStory<TStory>);
  entry.subscribers.set(token, subscriber);

  try {
    await ensureBridge(entry);
  } catch (error) {
    entry.subscribers.delete(token);
    entry.subscriberOptions.delete(token);
    destroyIfOrphaned(entry);
    throw error;
  }

  return () => {
    if (!entry.subscribers.delete(token)) return;
    entry.subscriberOptions.delete(token);
    retractSubscriber(entry);
  };
}
