import type { ISbStoryData } from "@storyblok/js";
import { createLivePreviewHandler } from "@storyblok/live-preview";

const SERVER_DATA_ELEMENT_ID = "__STORYBLOK_SERVERDATA__";
const DISABLE_LIVE_PREVIEW_META = "storyblok-live-preview";
const LIVE_PREVIEW_UPDATING_EVENT = "storyblok-live-preview-updating";
const LIVE_PREVIEW_UPDATED_EVENT = "storyblok-live-preview-updated";

const previewHandler = createLivePreviewHandler<ISbStoryData>({
  currentRoot: () => document.body,
  update: ({ story, signal }) => getNewHTMLBody(story, signal),
  onBeforeUpdate: (story) => {
    if (isLivePreviewDisabled()) {
      return false;
    }
    return !dispatchStoryblokEvent(LIVE_PREVIEW_UPDATING_EVENT, { story }, true).defaultPrevented;
  },
  onUpdated: (story) => {
    dispatchStoryblokEvent(LIVE_PREVIEW_UPDATED_EVENT, { story });
  },
  onError: (error) => {
    console.error("Failed to update live preview:", error);
  },
  onReload: () => {
    location.reload();
  },
});

/**
 * Handles Storyblok Visual Editor events for Astro's server-rendered pages.
 *
 * Astro owns the POST payload and server-data conventions, while the shared
 * live-preview package owns scheduling, cancellation, and DOM morphing.
 */
export function handleStoryblokMessage(
  event: { action: string; story?: ISbStoryData } | null | undefined,
): Promise<void> {
  if (event?.action === "input" && isLivePreviewDisabled()) {
    return Promise.resolve();
  }
  return previewHandler.handle(event);
}

function isLivePreviewDisabled(): boolean {
  const metaTag = document.querySelector<HTMLMetaElement>(
    `meta[name="${DISABLE_LIVE_PREVIEW_META}"]`,
  );
  return metaTag?.content === "disabled" || metaTag?.content === "false";
}

async function getNewHTMLBody(story: ISbStoryData, signal: AbortSignal): Promise<HTMLElement> {
  const serverData = extractServerData(document.body);
  const payload = {
    story: {
      ...story,
      is_storyblok_preview: true,
    },
    ...(isPlainObject(serverData) && { serverData }),
  };

  const response = await fetch(location.href, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch updated HTML: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return new DOMParser().parseFromString(html, "text/html").body;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

function extractServerData(body: HTMLElement): unknown | null {
  const serverDataElement = body.querySelector(`#${SERVER_DATA_ELEMENT_ID}`);
  if (!serverDataElement?.textContent) {
    return null;
  }

  try {
    return JSON.parse(serverDataElement.textContent);
  } catch (error) {
    console.error("Failed to parse server data:", error);
    return null;
  }
}

function dispatchStoryblokEvent<T>(name: string, detail?: T, cancelable = false): CustomEvent<T> {
  const event = new CustomEvent<T>(name, { detail, cancelable });
  document.dispatchEvent(event);
  return event;
}
