"use client";

import {
  type ISbStoryData,
  loadStoryblokBridge,
  registerStoryblokBridge,
  type StoryblokBridgeConfigV2,
} from "@storyblok/js";
import { startTransition, useEffect } from "react";
import { readEditorTokenFromLocation } from "../core/editor-token";
import { isBridgeLoaded, isVisualEditor } from "../utils";
import type { LiveEditRejectionReason } from "./live-edit-update-action";

type LiveEditWarning = LiveEditRejectionReason | "missing" | "restricted-release";

const CLIENT_MESSAGES: Record<LiveEditWarning, string> = {
  missing:
    "missing Visual Editor token (_storyblok_tk) in the URL, live updates are disabled. Open the story from the Storyblok Visual Editor.",
  "restricted-release":
    "live updates aren't supported when previewing a release with restricted access. Save the story to see your changes.",
  "invalid-request": "the server rejected the live update as invalid.",
  "no-server-token":
    "the server has no preview access token configured, live updates are disabled. See the server log for details.",
  malformed: "the server rejected the Visual Editor token, live updates are disabled.",
  expired:
    "the Visual Editor token has expired, live updates are disabled. Reload the story in the Visual Editor.",
  mismatch:
    "the server rejected the Visual Editor token. Make sure the server uses your space's first preview access token.",
  "crypto-unavailable":
    "the server can't verify the Visual Editor token (Web Crypto unavailable), live updates are disabled.",
};

const StoryblokLiveEditing = ({
  story = null,
  bridgeOptions = {},
}: {
  story: ISbStoryData;
  bridgeOptions?: StoryblokBridgeConfigV2;
}) => {
  const inVisualEditor = isVisualEditor();

  if (!inVisualEditor) {
    return null;
  }

  const storyId = typeof story?.id === "number" ? story.id : null;
  useEffect(() => {
    if (storyId === null) {
      return;
    }

    // Warn once per reason and mount, instead of on every keystroke.
    const warned = new Set<LiveEditWarning>();
    const warnOnce = (reason: LiveEditWarning) => {
      if (warned.has(reason)) {
        return;
      }
      warned.add(reason);
      console.warn(`StoryblokLiveEditing: ${CLIENT_MESSAGES[reason]}`);
    };

    (async () => {
      // In RSC environments, Storyblok components are server-side rendered,
      // so the bridge script is never automatically loaded on the client.
      // We need to explicitly load it here for live editing to work.
      if (!isBridgeLoaded()) {
        await loadStoryblokBridge();
      }

      const handleInput = async (incoming: ISbStoryData) => {
        if (!incoming) {
          return;
        }

        const tokenResult = readEditorTokenFromLocation();
        if (tokenResult.status !== "ok") {
          warnOnce(tokenResult.status);
          return;
        }

        try {
          const { liveEditUpdateAction } = await import("./live-edit-update-action");

          startTransition(() => {
            void Promise.resolve(
              liveEditUpdateAction({
                story: incoming,
                pathToRevalidate: window.location.pathname,
                editorToken: tokenResult.editorToken,
              }),
            )
              .then((result) => {
                if (result && "reason" in result) {
                  warnOnce(result.reason);
                }
              })
              .catch((error: unknown) => {
                console.warn("StoryblokLiveEditing: live update request failed:", error);
              });
          });
        } catch (error) {
          console.warn("StoryblokLiveEditing: server action not available:", error);
        }
      };

      registerStoryblokBridge(storyId, (newStory) => handleInput(newStory), bridgeOptions);
    })();
  }, [storyId, JSON.stringify(bridgeOptions)]);

  return null;
};

export default StoryblokLiveEditing;
