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
// Broker — one bridge instance per page, shared across all subscribers.
// Relation options are unioned because the editor only supports one bridge
// configuration per page.
// ---------------------------------------------------------------------------

type Subscriber = (story: LivePreviewStory) => void;

type BridgeEntry = {
  bridge?: StoryblokBridge;
  bridgePromise?: Promise<StoryblokBridge>;
  subscribers: Map<symbol, Subscriber>;
  options: BridgeParams;
  optionsVersion: number;
  appliedOptionsVersion: number;
  reconciling: boolean;
};

let broker: BridgeEntry | undefined;

const scalarOptionKeys = [
  "customParent",
  "resolveLinks",
  "preventClicks",
  "fallbackLang",
] as const satisfies readonly (keyof BridgeParams)[];

function mergeBridgeOptions(entry: BridgeEntry, options?: BridgeParams): boolean {
  if (!options) return false;

  let changed = false;
  const currentRelations = entry.options.resolveRelations ?? [];
  const newRelations = options.resolveRelations ?? [];
  const relations = [...new Set([...currentRelations, ...newRelations])];

  if (relations.length !== currentRelations.length) {
    entry.options.resolveRelations = relations;
    changed = true;
  }

  for (const key of scalarOptionKeys) {
    const value = options[key];
    if (value === undefined) continue;

    if (entry.options[key] === undefined) {
      switch (key) {
        case "customParent":
          entry.options.customParent = options.customParent;
          break;
        case "resolveLinks":
          entry.options.resolveLinks = options.resolveLinks;
          break;
        case "preventClicks":
          entry.options.preventClicks = options.preventClicks;
          break;
        case "fallbackLang":
          entry.options.fallbackLang = options.fallbackLang;
          break;
      }
      changed = true;
    } else if (entry.options[key] !== value) {
      console.warn(
        `[Storyblok] Conflicting live preview option "${key}" ignored; using the first value.`,
      );
    }
  }

  if (changed) entry.optionsVersion += 1;
  return changed;
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
  // Let other subscriptions made in the same tick contribute their options
  // before constructing the bridge.
  await Promise.resolve();

  while (entry.appliedOptionsVersion < entry.optionsVersion) {
    const optionsVersion = entry.optionsVersion;
    const previousBridge = entry.bridge;
    const bridge = await loadStoryblokBridge({ ...entry.options, initOnlyOnce: false });

    if (broker !== entry || entry.subscribers.size === 0) {
      bridge.destroy();
      return previousBridge ?? bridge;
    }

    attachBridgeEvents(entry, bridge);
    entry.bridge = bridge;
    entry.appliedOptionsVersion = optionsVersion;
    previousBridge?.destroy();
  }

  if (!entry.bridge) {
    throw new Error("Storyblok live preview bridge was not created");
  }

  return entry.bridge;
}

function ensureBridge(entry: BridgeEntry): Promise<StoryblokBridge> {
  if (
    entry.bridgePromise &&
    (entry.reconciling || entry.appliedOptionsVersion === entry.optionsVersion)
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
    options: {},
    optionsVersion: 1,
    appliedOptionsVersion: 0,
    reconciling: false,
  };
  return broker;
}

/**
 * Registers a callback for Storyblok Visual Editor live preview updates.
 *
 * All subscriptions on a page share a single bridge instance. The bridge
 * unions relation options and is torn down only when every subscriber has
 * unsubscribed. This avoids duplicate
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
  mergeBridgeOptions(entry, bridgeOptions);
  const token = Symbol();
  const subscriber: Subscriber = (story) => callback(story as LivePreviewStory<TStory>);
  entry.subscribers.set(token, subscriber);

  try {
    await ensureBridge(entry);
  } catch (error) {
    entry.subscribers.delete(token);
    throw error;
  }

  return () => {
    if (!entry.subscribers.delete(token)) return;
    if (entry.subscribers.size > 0) return;

    if (broker === entry) broker = undefined;
    entry.bridge?.destroy();
    entry.bridge = undefined;
  };
}
