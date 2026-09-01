import type StoryblokBridge from "@storyblok/preview-bridge";
import type { BridgeParams } from "@storyblok/preview-bridge";
import type { Prettify } from "./generated/types/_utils";
import type { Story } from "./generated/types/story";

import { loadStoryblokBridge } from "./loadStoryblokBridge";
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
// Broker — one bridge instance per unique options key, shared across all
// subscribers with the same config. Prevents duplicate bridges, duplicate
// `window.message` listeners, and duplicate overlay DOM when the same page
// mounts several components that each subscribe to editor events.
// ---------------------------------------------------------------------------

type Subscriber = (story: LivePreviewStory) => void;

type BridgeEntry = {
  bridge: Promise<StoryblokBridge>;
  subscribers: Set<Subscriber>;
};

const entries = new Map<string, BridgeEntry>();
let unshareableCount = 0;

/**
 * Returns a stable cache key for the given options, or `undefined` when the
 * options cannot be safely shared (contain function values or circular refs).
 * `initOnlyOnce` is excluded because it is always forced to `false`.
 */
function optionsKey(options: BridgeParams | undefined): string | undefined {
  try {
    const { initOnlyOnce: _, ...rest } = options ?? {};
    let hasFunction = false;
    const key = JSON.stringify(rest, (_, value) => {
      if (typeof value === "function") {
        hasFunction = true;
        return undefined;
      }
      return value;
    });
    return hasFunction ? undefined : key;
  } catch {
    return undefined;
  }
}

function acquire(key: string, bridgeOptions: BridgeParams | undefined): BridgeEntry {
  const existing = entries.get(key);
  if (existing) return existing;

  const subscribers = new Set<Subscriber>();

  // Cache the promise, not the resolved instance: two subscribers mounting in
  // the same tick would otherwise both miss the cache and construct two bridges.
  const bridge = loadStoryblokBridge({ ...bridgeOptions, initOnlyOnce: false }).then((instance) => {
    instance.on(["input", "change", "published"], (event) => {
      if (!event) return;

      if (event.action === "input" && event.story) {
        const story = event.story as LivePreviewStory;
        for (const subscriber of subscribers) subscriber(story);
        return;
      }

      if ((event.action === "change" || event.action === "published") && subscribers.size > 0) {
        window.location.reload();
      }
    });
    return instance;
  });

  const entry: BridgeEntry = { bridge, subscribers };
  entries.set(key, entry);
  return entry;
}

/** @internal For testing only — resets all shared broker state. */
export function _resetBrokerState(): void {
  entries.clear();
  unshareableCount = 0;
}

/**
 * Registers a callback for Storyblok Visual Editor live preview updates.
 *
 * Subscriptions with identical options share a single bridge instance. The
 * bridge is only constructed once per unique options key and torn down only
 * when every subscriber with that key has unsubscribed. This avoids duplicate
 * `window.message` listeners and duplicate overlay DOM when multiple components
 * subscribe on the same page.
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
 * subscriber for its options key the bridge is also destroyed, removing all
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

  const key = optionsKey(bridgeOptions) ?? `unshareable:${++unshareableCount}`;
  const entry = acquire(key, bridgeOptions);
  const subscriber = callback as Subscriber;
  entry.subscribers.add(subscriber);
  await entry.bridge;

  return () => {
    if (!entry.subscribers.delete(subscriber)) return;
    if (entry.subscribers.size > 0) return;

    entries.delete(key);
    entry.bridge.then((instance) => {
      instance.destroy();
    });
  };
}
