import type { Story } from "@storyblok/live-preview";

const SERVER_DATA_ELEMENT_ID = "__STORYBLOK_SERVERDATA__";

/**
 * Posts the updated story back to the current page and parses the server's
 * re-rendered HTML response.
 *
 * Astro owns the POST payload and server-data conventions; the shared
 * live-preview package applies the resulting DOM.
 */
export async function getNewHTMLBody(story: Story, signal: AbortSignal): Promise<HTMLElement> {
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
