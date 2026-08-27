"use client";

import { useStoryblokEditorEvent } from "@storyblok/react/client";

/**
 * Mounts the Storyblok Preview Bridge when running inside the Visual Editor.
 * Renders nothing — exists only to trigger bridge initialisation as a side-effect.
 */
export function BridgeLoader() {
  useStoryblokEditorEvent(() => {});
  return null;
}
