import { storyblokInit as sbInit } from "@storyblok/js";

import type { SbReactSDKOptions, StoryblokClient } from "@/types";

import {
  getComponent,
  getCustomFallbackComponent,
  getEnableFallbackComponent,
  getStoryblokApiInstance,
  setComponents,
  setCustomFallbackComponent,
  setEnableFallbackComponent,
  setStoryblokApiInstance,
} from "./state";
import { useStoryblokApi } from "./use-storyblok-api";

export const storyblokInit = (pluginOptions: SbReactSDKOptions = {}): (() => StoryblokClient) => {
  // Apply component settings on every call, so that a re-evaluated module (e.g. during
  // dev hot reload) replaces the previously registered components.
  if (pluginOptions.components) {
    setComponents(pluginOptions.components);
  }
  if (pluginOptions.enableFallbackComponent !== undefined) {
    setEnableFallbackComponent(pluginOptions.enableFallbackComponent);
  }
  if (pluginOptions.customFallbackComponent) {
    setCustomFallbackComponent(pluginOptions.customFallbackComponent);
  }

  const existingInstance = getStoryblokApiInstance();
  if (existingInstance) {
    return () => existingInstance;
  }

  const { storyblokApi } = sbInit(pluginOptions);
  setStoryblokApiInstance(storyblokApi);

  return () => storyblokApi;
};

export { getComponent, getCustomFallbackComponent, getEnableFallbackComponent, setComponents };
export { useStoryblokApi as getStoryblokApi };
export { apiPlugin, storyblokEditable } from "@storyblok/js";
