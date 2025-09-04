"use client";

import { resolveRelations } from "@/lib/getStory";
import { StoryblokBridgeV2 } from "@storyblok/js";
import { useEffect } from "react";
import { useSWRConfig } from "swr";

declare global {
  interface window {
    StoryblokBridge: StoryblokBridgeV2;
  }
}

export const BridgeHandler = () => {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const bridge = new window.StoryblokBridge({
      resolveRelations: resolveRelations,
    });

    bridge.on("input", (event) => {
      if (!event || !event.story) return;
      mutate(`cdn/stories/${event.story.slug}`, event.story, {
        revalidate: false,
      });
    });
  }, []);

  return null;
};

export default BridgeHandler;
