import type { ISbStoryData } from '@storyblok/js';
import morphdom from 'morphdom';

let timeout: NodeJS.Timeout;

/**
 * Checks if live preview is disabled via meta tag
 */
function isLivePreviewDisabled(): boolean {
  const metaTag = document.querySelector<HTMLMetaElement>(
    'meta[name="storyblok-live-preview"]',
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

  if (action === 'input' && story) {
    // Check if live preview is disabled via meta tag
    if (isLivePreviewDisabled()) {
      return;
    }

    // Debounce the getNewHTMLBody function
    const debouncedGetNewHTMLBody = async () => {
      // Dispatch cancelable event to allow users to prevent the update
      const updatingEvent = dispatchStoryblokEvent(
        'storyblok-live-preview-updating',
        { story },
        true,
      );

      // If the event was prevented, skip the update
      if (updatingEvent.defaultPrevented) {
        return;
      }

      const currentBody = document.body;
      let serverData = null;
      const serverDataElement = currentBody.querySelector('#__STORYBLOK_SERVERDATA__');
      if (serverDataElement) {
        try {
          serverData = JSON.parse(serverDataElement.textContent || '{}');
        }
        catch (e) {
          console.error('Failed to parse server-data:', e);
        }
      }
      const newBody = await getNewHTMLBody(story, serverData);
      if (newBody.outerHTML === currentBody.outerHTML) {
        // No changes detected, but still dispatch updated event to match updating event
        dispatchStoryblokEvent('storyblok-live-preview-updated', { story });
        return;
      }
      // Get current focused element in Storyblok
      const focusedElem = document.querySelector('[data-blok-focused="true"]');
      updateDOMWithNewBody(currentBody, newBody, focusedElem);
      // Dispatch a custom event after the body update
      dispatchStoryblokEvent('storyblok-live-preview-updated', { story });
    };
    const debounceDelay = 500; // Adjust the delay as needed
    clearTimeout(timeout);
    timeout = setTimeout(debouncedGetNewHTMLBody, debounceDelay);
  }

  if (['published', 'change'].includes(event?.action)) {
    location.reload();
  }
}

/**
 * Preserves interactive state attributes from current element to new element
 * Only preserves state if content is similar (same component, just edited)
 */
function preserveElementAttributes(fromEl: Element, toEl: Element) {
  // Same content - copy all attributes from current element to new element
  // This preserves interactive state like 'open', 'checked', 'value', etc.
  Array.from(fromEl.attributes).forEach((attr) => {
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
    const focusedElementID = focusedElem.getAttribute('data-blok-uid');
    // Now find the same element by above [data-blok-uid] in our new virtual HTML page
    const newDomFocusElem = newBody.querySelector(
      `[data-blok-uid="${focusedElementID}"]`,
    );
    if (newDomFocusElem) {
      // Add the [data-blok-focused] attribute to the above element
      newDomFocusElem.setAttribute('data-blok-focused', 'true');
      // Use morphdom to update the focused element while preserving state
      morphdom(focusedElem, newDomFocusElem, {
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
      onBeforeElUpdated: (fromEl, toEl) => {
        // Preserve elements with data-preserve-state
        if (fromEl.hasAttribute('data-preserve-state')) {
          return false; // Skip this element
        }

        preserveElementAttributes(fromEl, toEl);
        return true;
      },
    });
  }
}

async function getNewHTMLBody(story: ISbStoryData, serverData?: unknown) {
  // TODO How to handel (50x, 405, etc.)
  const result = await fetch(location.href, {
    method: 'POST',
    body: JSON.stringify({
      story: {
        ...story,
        is_storyblok_preview: true,
      },
      ...(serverData && typeof serverData === 'object' ? { serverData } : {}),
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const html = await result.text();
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
