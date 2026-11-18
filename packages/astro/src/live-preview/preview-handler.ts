import type { LivePreviewHandler, Story } from "@storyblok/live-preview";
import { createLivePreviewHandler } from "@storyblok/live-preview";
import { getNewHTMLBody } from "./get-new-html-body";

const LIVE_PREVIEW_UPDATING_EVENT = "storyblok-live-preview-updating";
const LIVE_PREVIEW_UPDATED_EVENT = "storyblok-live-preview-updated";

/**
 * Creates Storyblok's live-preview handler for Astro's server-rendered pages.
 *
 * Astro owns the POST payload and server-data conventions, while the shared
 * live-preview package owns scheduling, cancellation, and DOM morphing.
 */
export function createPreviewHandler(
  options: { debounceMs?: number } = {},
): LivePreviewHandler<Story> {
  return createLivePreviewHandler({
    currentRoot: () => document.body,
    update: ({ story, signal }) => getNewHTMLBody(story, signal),
    debounceMs: options.debounceMs,
    // Keeps client-side attribute changes (an opened `<details>`, a toggled
    // `class`) intact across an edit, as v10 did, while attributes the client
    // never touched still follow the server render (e.g. a `class:list`
    // derived from a field, see #805). The morph's own default
    // (`preserveElementAttributes: false`) would reset that client state on
    // every keystroke.
    morph: { preserveElementAttributes: true },
    onBeforeUpdate: (story) =>
      !dispatchStoryblokEvent(LIVE_PREVIEW_UPDATING_EVENT, { story }, true).defaultPrevented,
    onUpdated: (story) => {
      dispatchStoryblokEvent(LIVE_PREVIEW_UPDATED_EVENT, { story });
    },
    onError: (error) => {
      console.error("[storyblok] Failed to update live preview:", error);
    },
    onReload: () => {
      location.reload();
    },
  });
}

function dispatchStoryblokEvent<T>(name: string, detail?: T, cancelable = false): CustomEvent<T> {
  const event = new CustomEvent<T>(name, { detail, cancelable });
  document.dispatchEvent(event);
  return event;
}
