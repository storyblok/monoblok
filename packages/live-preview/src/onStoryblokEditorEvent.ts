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

/**
 * Registers a callback for Storyblok Visual Editor live preview updates.
 *
 * Loads the Preview Bridge with the supplied config, attaches event
 * listeners, and returns a cleanup function. Each call is self-contained —
 * no shared module-level state, so config is always respected and multiple
 * independent subscriptions can coexist on the same page.
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
 * A cleanup function that destroys the bridge instance, removing all its
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

  let active = true;
  // Force initOnlyOnce: false so that every call gets its own fully-initialised
  // bridge instance with its own window `message` listener. The bridge defaults
  // to initOnlyOnce: true, which silently skips addMessageListener() when a
  // .storyblok__hint element is already in the DOM (left by a prior instance),
  // making any second concurrent subscription permanently deaf to editor events.
  const bridge = await loadStoryblokBridge({ ...bridgeOptions, initOnlyOnce: false });

  bridge.on(["input", "change", "published"], (event) => {
    if (!active || !event) {
      return;
    }

    if (event.action === "input" && event.story) {
      callback(event.story as LivePreviewStory<TStory>);
      return;
    }

    if (event.action === "change" || event.action === "published") {
      window.location.reload();
    }
  });

  return () => {
    if (!active) return;
    active = false;
    bridge.destroy();
  };
}
