"use client";

import {
  type ISbStoryData,
  loadStoryblokBridge,
  registerStoryblokBridge,
  type StoryblokBridgeConfigV2,
} from "@storyblok/js";
import { type ReactNode, startTransition, useEffect, useRef, useState } from "react";
import { isBridgeLoaded, isVisualEditor } from "../utils";
import type { LiveEditRenderProps } from "./live-edit-props";
import type { LiveEditRenderResult } from "./live-edit-render-action";

type LiveEditRenderAction = (input: {
  story: Pick<ISbStoryData, "content">;
  props?: LiveEditRenderProps;
}) => Promise<LiveEditRenderResult>;

interface StoryblokLiveEditingProps {
  story: ISbStoryData;
  bridgeOptions?: StoryblokBridgeConfigV2;
  /**
   * Server-rendered story. Shown until the first Visual Editor update has been
   * rendered, and for every visitor outside the Visual Editor.
   */
  children?: ReactNode;
  /** @internal Server Action that renders an updated story; passed by `StoryblokStory`. */
  renderAction?: LiveEditRenderAction;
  /** @internal Props forwarded to the rendered story; passed by `StoryblokStory`. */
  renderProps?: LiveEditRenderProps;
}

type InputHandler = (story: ISbStoryData) => void;

/**
 * The bridge only delivers events to the first listener registered on the page,
 * and has no way to remove one. So each story id is registered once, through a
 * dispatcher that forwards to the handler of the currently mounted component.
 * Remounts (React Strict Mode, client-side navigation) replace the handler
 * instead of registering a listener that would never be called.
 */
const inputHandlers = new Map<number, InputHandler>();
const registeredStoryIds = new Set<number>();

const subscribe = (
  storyId: number,
  handler: InputHandler,
  bridgeOptions: StoryblokBridgeConfigV2,
): (() => void) => {
  inputHandlers.set(storyId, handler);
  if (!registeredStoryIds.has(storyId)) {
    registeredStoryIds.add(storyId);
    registerStoryblokBridge(storyId, (story) => inputHandlers.get(storyId)?.(story), bridgeOptions);
  }
  return () => {
    if (inputHandlers.get(storyId) === handler) {
      inputHandlers.delete(storyId);
    }
  };
};

/**
 * Connects a server-rendered story to the Storyblok Visual Editor.
 *
 * On every Visual Editor change, it asks the server to render the updated story
 * and shows the result. The rendered update only reaches this browser: nothing
 * is cached or revalidated on the server.
 */
const StoryblokLiveEditing = ({
  story = null,
  bridgeOptions = {},
  children = null,
  renderAction,
  renderProps,
}: StoryblokLiveEditingProps): ReactNode => {
  const [liveContent, setLiveContent] = useState<{ node: ReactNode } | null>(null);
  const latest = useRef({ renderAction, renderProps });
  latest.current = { renderAction, renderProps };

  const storyId = typeof story?.id === "number" ? story.id : null;
  useEffect(() => {
    if (storyId === null || !isVisualEditor()) {
      return;
    }

    let disposed = false;
    let unsubscribe: (() => void) | null = null;
    let inFlight = false;
    let queued: ISbStoryData | null = null;
    let retried = false;

    // One render at a time. A story arriving meanwhile replaces any queued one,
    // so fast typing renders the latest content without piling up requests.
    const render = (incoming: ISbStoryData) => {
      const action = latest.current.renderAction;
      if (!action) {
        return;
      }
      inFlight = true;
      Promise.resolve(
        action({ story: { content: incoming.content }, props: latest.current.renderProps }),
      )
        .then((result) => {
          if (disposed || !result) {
            return;
          }
          if (result.ok) {
            const { node } = result;
            startTransition(() => setLiveContent({ node }));
          } else if ("retry" in result && result.retry && !retried) {
            // The server instance was cold and has now loaded the app's
            // components. Send the story again, unless a newer one is queued.
            retried = true;
            queued ??= incoming;
          }
        })
        .catch((error: unknown) => {
          console.warn("StoryblokLiveEditing: rendering the live update failed:", error);
        })
        .finally(() => {
          inFlight = false;
          const next = queued;
          queued = null;
          if (next && !disposed) {
            render(next);
          }
        });
    };

    const handleInput = (incoming: ISbStoryData) => {
      // Visual History sends stories without content: keep the current render.
      if (disposed || !incoming || incoming.content == null) {
        return;
      }
      if (inFlight) {
        queued = incoming;
        return;
      }
      render(incoming);
    };

    (async () => {
      // In RSC environments, Storyblok components are server-side rendered,
      // so the bridge script is never automatically loaded on the client.
      // We need to explicitly load it here for live editing to work.
      if (!isBridgeLoaded()) {
        await loadStoryblokBridge();
      }
      if (!disposed) {
        unsubscribe = subscribe(storyId, handleInput, bridgeOptions);
      }
    })();

    return () => {
      disposed = true;
      queued = null;
      unsubscribe?.();
    };
  }, [storyId, JSON.stringify(bridgeOptions)]);

  return <>{liveContent ? liveContent.node : children}</>;
};

export default StoryblokLiveEditing;
