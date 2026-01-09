import type { ISbStoryData } from '@storyblok/js';

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
      const updatingEvent = dispatchCancelableStoryblokEvent(
        'storyblok-live-preview-updating',
        { story },
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
      // console.log("Doing partial replace");
      focusedElem.replaceWith(newDomFocusElem);
    }
  }
  else {
    // console.log("Doing full replace");
    currentBody.replaceWith(newBody);
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
 */
function dispatchStoryblokEvent<T>(name: string, detail?: T) {
  document.dispatchEvent(new CustomEvent<T>(name, { detail }));
}

/**
 * Dispatches a cancelable custom event with optional detail payload.
 * Returns the event object so the caller can check if preventDefault() was called.
 */
function dispatchCancelableStoryblokEvent<T>(name: string, detail?: T) {
  const event = new CustomEvent<T>(name, { detail, cancelable: true });
  document.dispatchEvent(event);
  return event;
}
