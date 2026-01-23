import type { ISbStoryData } from '@storyblok/js';
import morphdom from 'morphdom';

let timeout: NodeJS.Timeout;

const DEBOUNCE_DELAY_MS = 500;
const SERVER_DATA_ELEMENT_ID = '__STORYBLOK_SERVERDATA__';
const STORYBLOK_FOCUSED_ATTRIBUTE = 'data-blok-focused';
const STORYBLOK_UID_ATTRIBUTE = 'data-blok-uid';
const PRESERVE_STATE_ATTRIBUTE = 'data-preserve-state';
const DISABLE_LIVE_PREVIEW_META = 'storyblok-live-preview';
const LIVE_PREVIEW_UPDATING_EVENT = 'storyblok-live-preview-updating';
const LIVE_PREVIEW_UPDATED_EVENT = 'storyblok-live-preview-updated';

/**
 * Checks if live preview is disabled via meta tag
 */
function isLivePreviewDisabled(): boolean {
  const metaTag = document.querySelector<HTMLMetaElement>(
    `meta[name="${DISABLE_LIVE_PREVIEW_META}"]`,
  );
  return metaTag?.content === 'disabled' || metaTag?.content === 'false';
}

/**
 * Our current tests indicate that the post request section
 * is the bottleneck in terms of time consumption.
 * We should explore alternative methods to optimize
 * this process and improve efficiency.
 */
export async function handleStoryblokMessage(event: {
  action: string;
  story: ISbStoryData;
}) {
  const { action, story } = event || {};

  if (['published', 'change'].includes(action)) {
    location.reload();
    return;
  }
  // Handle input events with debouncing
  if (action === 'input' && story) {
    // Early return if live preview is disabled
    if (isLivePreviewDisabled()) {
      return;
    }
    // Clear existing debounce timeout
    if (timeout) {
      clearTimeout(timeout);
    }

    // Debounce the DOM update to avoid excessive re-renders
    timeout = setTimeout(async () => {
      try {
        await updateLivePreview(story);
      }
      catch (error) {
        console.error('Failed to update live preview:', error);
      }
    }, DEBOUNCE_DELAY_MS);
  }
}
/**
 * Performs the live preview update by fetching new HTML and morphing the DOM
 */
async function updateLivePreview(story: ISbStoryData): Promise<void> {
  // Dispatch cancelable event to allow users to prevent the update
  const updatingEvent = dispatchStoryblokEvent(
    LIVE_PREVIEW_UPDATING_EVENT,
    { story },
    true,
  );
    // If the event was prevented, skip the update
  if (updatingEvent.defaultPrevented) {
    return;
  }
  const currentBody = document.body;

  // Extract server data once (cached on page)
  const serverData = extractServerData(currentBody);

  // Fetch new HTML from server
  const newBody = await getNewHTMLBody(story, serverData);

  // Early return if no changes detected
  if (newBody.outerHTML === currentBody.outerHTML) {
    dispatchStoryblokEvent(LIVE_PREVIEW_UPDATED_EVENT, { story });
    return;
  }
  // Get currently focused element in Storyblok's Visual Editor
  const focusedElem = document.querySelector(`[${STORYBLOK_FOCUSED_ATTRIBUTE}="true"]`);

  // Update DOM while preserving interactive state
  updateDOMWithNewBody(currentBody, newBody, focusedElem);

  // Dispatch success event
  dispatchStoryblokEvent(LIVE_PREVIEW_UPDATED_EVENT, { story });
}
/**
 * Returns a unique key for an element based on its data-blok-uid attribute
 * Used by morphdom to match elements between old and new DOM trees
 */
function getNodeKey(node: Node) {
  if (node.nodeType === 1) { // Element node
    const uid = (node as Element).getAttribute(STORYBLOK_UID_ATTRIBUTE);
    if (uid) {
      return uid;
    }
  }
  return undefined;
}

/**
 * Preserves interactive state attributes from current element to new element
 * Only preserves state if content is similar (same component, just edited)
 */
function preserveElementAttributes(fromEl: Element, toEl: Element) {
  const fromUid = fromEl.attributes.getNamedItem(STORYBLOK_UID_ATTRIBUTE)?.value;
  const toUid = toEl.attributes.getNamedItem(STORYBLOK_UID_ATTRIBUTE)?.value;

  // Same content - copy all attributes from current element to new element
  // This preserves interactive state like 'open', 'checked', 'value', etc.
  if (fromUid && fromUid !== toUid) {
    return;
  }

  Array.from(fromEl.attributes).forEach((attr) => {
    // Skip copying data-blok-uid - it should always come from the new element
    if (attr.name === STORYBLOK_UID_ATTRIBUTE) {
      return;
    }
    const currentValue = attr.value;
    const newValue = toEl.getAttribute(attr.name);
    // Add or update attribute if it doesn't exist in toEl or has a different value
    if (!toEl.hasAttribute(attr.name) || newValue !== currentValue) {
      toEl.setAttribute(attr.name, currentValue);
    }
  });
}

function updateDOMWithNewBody(
  currentBody: HTMLElement,
  newBody: HTMLElement,
  focusedElem: Element | null,
) {
  if (focusedElem) {
    // Get the [data-blok-uid] of the focused element in storyblok
    const focusedElementID = focusedElem.getAttribute(STORYBLOK_UID_ATTRIBUTE);

    // Now find the same element by above [data-blok-uid] in our new virtual HTML page
    const newDomFocusElem = newBody.querySelector(
      `[data-blok-uid="${focusedElementID}"]`,
    );
    if (newDomFocusElem) {
      // Add the [data-blok-focused] attribute to the above element
      newDomFocusElem.setAttribute(STORYBLOK_FOCUSED_ATTRIBUTE, 'true');
      // Use morphdom to update the focused element while preserving state
      morphdom(focusedElem, newDomFocusElem, {
        getNodeKey,
        onBeforeElUpdated: (fromEl, toEl) => {
          // Don't check data-preserve-state here - user is editing this component
          // and wants to see their changes reflected
          preserveElementAttributes(fromEl, toEl);
          return true;
        },
      });
    }
  }
  else {
    // Use morphdom to efficiently morph the DOM while preserving state
    morphdom(currentBody, newBody, {
      getNodeKey,
      onBeforeElUpdated: (fromEl, toEl) => {
        // Preserve elements with data-preserve-state
        if (fromEl.hasAttribute(PRESERVE_STATE_ATTRIBUTE)) {
          return false; // Skip this element
        }

        preserveElementAttributes(fromEl, toEl);
        return true;
      },
    });
  }
}
const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== 'object') {
    return false;
  }
  if (Array.isArray(v)) {
    return false;
  }

  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};
async function getNewHTMLBody(story: ISbStoryData, serverData?: unknown) {
  // TODO How to handel (50x, 405, etc.)
  const payload = {
    story: {
      ...story,
      is_storyblok_preview: true,
    },
    ...(isPlainObject(serverData) && { serverData }),
  };

  const response = await fetch(location.href, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
    // Handle HTTP errors
  if (!response.ok) {
    throw new Error(
      `Failed to fetch updated HTML: ${response.status} ${response.statusText}`,
    );
  }
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body;
}

/**
 * Dispatches a custom event with optional detail payload.
 * Returns the event object so the caller can check if preventDefault() was called.
 */
function dispatchStoryblokEvent<T>(name: string, detail?: T, cancelable = false) {
  const event = new CustomEvent<T>(name, { detail, cancelable });
  document.dispatchEvent(event);
  return event;
}

/**
 * Extracts server data from the hidden script element
 */
function extractServerData(body: HTMLElement): unknown | null {
  const serverDataElement = body.querySelector(`#${SERVER_DATA_ELEMENT_ID}`);
  if (!serverDataElement?.textContent) {
    return null;
  }

  try {
    return JSON.parse(serverDataElement.textContent || '{}');
  }
  catch (error) {
    console.error('Failed to parse server data:', error);
    return null;
  }
}
