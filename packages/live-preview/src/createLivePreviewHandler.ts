import type { DomMorphOptions } from "./dom/morphStoryblokDom";

import { morphStoryblokDom } from "./dom/morphStoryblokDom";

export type LivePreviewEvent<TStory extends object = Record<string, unknown>> = {
  action: string;
  story?: TStory;
};

export type LivePreviewUpdateContext<TStory extends object> = {
  story: TStory;
  signal: AbortSignal;
};

export type LivePreviewHandlerOptions<TStory extends object> = {
  /** Returns the current DOM root that should be updated. */
  currentRoot: () => Node;
  /** Fetches or renders the next DOM root for a story update. */
  update: (context: LivePreviewUpdateContext<TStory>) => Promise<Node>;
  /** Debounce delay for consecutive input events. Defaults to 500ms. */
  debounceMs?: number;
  /** DOM morphing behavior. */
  morph?: Omit<DomMorphOptions, "focusedElement">;
  /** Return false to cancel an update before calling `update`. */
  onBeforeUpdate?: (story: TStory) => boolean | void;
  /** Called after the next DOM tree has been applied. */
  onUpdated?: (story: TStory) => void;
  /** Called for non-abort update failures. */
  onError?: (error: unknown, story: TStory) => void;
  /** Called for `change` and `published` events. */
  onReload?: (action: "change" | "published") => void;
};

export type LivePreviewHandler<TStory extends object> = {
  handle: (event: LivePreviewEvent<TStory> | null | undefined) => Promise<void>;
  dispose: () => void;
};

/**
 * Creates an isolated Storyblok live-preview event handler.
 *
 * The handler owns event scheduling and request cancellation, while the caller
 * owns how updated content is fetched or rendered. Each instance has its own
 * timer and AbortController, so independent previews cannot cancel each other.
 */
export function createLivePreviewHandler<TStory extends object>(
  options: LivePreviewHandlerOptions<TStory>,
): LivePreviewHandler<TStory> {
  const debounceMs = options.debounceMs ?? 500;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abortController: AbortController | null = null;
  let active = true;

  const handle = async (event: LivePreviewEvent<TStory> | null | undefined): Promise<void> => {
    if (!active || !event) {
      return;
    }

    if (event.action === "change" || event.action === "published") {
      options.onReload?.(event.action);
      return;
    }

    if (event.action !== "input" || !event.story) {
      return;
    }

    abortController?.abort();
    if (timeout) {
      clearTimeout(timeout);
    }

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
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        options.onError?.(error, story);
      }
    }, debounceMs);
  };

  const dispose = (): void => {
    if (!active) {
      return;
    }
    active = false;
    if (timeout) {
      clearTimeout(timeout);
    }
    abortController?.abort();
  };

  return { handle, dispose };
}
