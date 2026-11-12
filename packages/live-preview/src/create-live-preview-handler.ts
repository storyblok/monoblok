import type { DomMorphOptions } from "./dom/morph-storyblok-dom";
import type { LivePreviewStory } from "./on-storyblok-editor-event";
import type { Story } from "./generated/types/story";

import { morphStoryblokDom } from "./dom/morph-storyblok-dom";

export type LivePreviewEvent<TStory extends Story = Story> = {
  action: string;
  story?: LivePreviewStory<TStory>;
};

export type LivePreviewUpdateContext<TStory extends Story> = {
  story: LivePreviewStory<TStory>;
  signal: AbortSignal;
};

export type LivePreviewHandlerOptions<TStory extends Story> = {
  /** Returns the current DOM root that should be updated. */
  currentRoot: () => Element;
  /** Fetches or renders the next DOM root for a story update. */
  update: (context: LivePreviewUpdateContext<TStory>) => Promise<Element>;
  /** Debounce delay for consecutive input events. Defaults to 500ms. */
  debounceMs?: number;
  /** DOM morphing behavior. */
  morph?: Omit<DomMorphOptions, "focusedElement">;
  /** Return false to cancel an update before calling `update`. */
  onBeforeUpdate?: (story: LivePreviewStory<TStory>) => boolean | void;
  /** Called after the next DOM tree has been applied. */
  onUpdated?: (story: LivePreviewStory<TStory>) => void;
  /**
   * Called for non-abort update failures: `update` throwing or rejecting,
   * or the morph throwing. Defaults to `console.error` when not given, so
   * failures never disappear silently.
   */
  onError?: (error: unknown, story: LivePreviewStory<TStory>) => void;
  /**
   * Called for `change` and `published` events. Defaults to
   * `window.location.reload()`, matching `onStoryblokEditorEvent`. Any
   * pending debounced `input` update is cancelled first, so a non-reloading
   * `onReload` (e.g. a refetch) can't be overwritten by a stale morph that
   * was already in flight.
   */
  onReload?: (action: "change" | "published") => void;
};

export type LivePreviewHandler<TStory extends Story> = {
  /**
   * Resolves once the event has been scheduled (and, for `change`/
   * `published`, once `onReload` has run). For `input`, that's before the
   * debounce delay, `update`, and the morph: it does not resolve once the
   * DOM has actually been updated.
   */
  handle: (event: LivePreviewEvent<TStory> | null | undefined) => Promise<void>;
  dispose: () => void;
};

function defaultOnError(error: unknown): void {
  console.error("[Storyblok] Live preview update failed:", error);
}

function defaultOnReload(): void {
  window.location.reload();
}

/**
 * Creates an isolated Storyblok live-preview event handler.
 *
 * The handler owns event scheduling and request cancellation, while the caller
 * owns how updated content is fetched or rendered. Each instance has its own
 * timer and AbortController, so independent previews cannot cancel each other.
 */
export function createLivePreviewHandler<TStory extends Story = Story>(
  options: LivePreviewHandlerOptions<TStory>,
): LivePreviewHandler<TStory> {
  const debounceMs = options.debounceMs ?? 500;
  const reportError = options.onError ?? defaultOnError;
  const reload = options.onReload ?? defaultOnReload;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abortController: AbortController | null = null;
  let active = true;

  const cancelPendingUpdate = (): void => {
    abortController?.abort();
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
  };

  const handle = async (event: LivePreviewEvent<TStory> | null | undefined): Promise<void> => {
    if (!active || !event) {
      return;
    }

    if (event.action === "change" || event.action === "published") {
      cancelPendingUpdate();
      try {
        reload(event.action);
      } catch (error) {
        if (event.story) {
          reportError(error, event.story);
        } else {
          defaultOnError(error);
        }
      }
      return;
    }

    if (event.action !== "input" || !event.story) {
      return;
    }

    cancelPendingUpdate();

    const story = event.story;
    timeout = setTimeout(async () => {
      const requestController = new AbortController();
      abortController = requestController;

      try {
        if (options.onBeforeUpdate?.(story) === false) {
          return;
        }

        const nextRoot = await options.update({ story, signal: requestController.signal });
        if (!active || requestController.signal.aborted || abortController !== requestController) {
          return;
        }

        morphStoryblokDom(options.currentRoot(), nextRoot, options.morph);
        options.onUpdated?.(story);
      } catch (error) {
        if (
          requestController.signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return;
        }
        reportError(error, story);
      }
    }, debounceMs);
  };

  const dispose = (): void => {
    if (!active) {
      return;
    }
    active = false;
    cancelPendingUpdate();
  };

  return { handle, dispose };
}
