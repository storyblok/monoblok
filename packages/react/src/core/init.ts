import { storyblokInit as sbInit } from '@storyblok/js';

import type {
  SbReactSDKOptions,
  StoryblokClient,
} from '@/types';

import {
  getComponent,
  getCustomFallbackComponent,
  getEnableFallbackComponent,
  getStoryblokApiInstance,
  setComponents,
  setCustomFallbackComponent,
  setEnableFallbackComponent,
  setStoryblokApiInstance,
} from './state';
import { useStoryblokApi } from './use-storyblok-api';

export const storyblokInit = (pluginOptions: SbReactSDKOptions = {}): (() => StoryblokClient) => {
  const existingInstance = getStoryblokApiInstance();
  if (existingInstance) {
    return () => existingInstance;
  }

  const { storyblokApi } = sbInit(pluginOptions);
  setStoryblokApiInstance(storyblokApi);

  if (pluginOptions.components) {
    setComponents(pluginOptions.components);
  }
  if (pluginOptions.enableFallbackComponent !== undefined) {
    setEnableFallbackComponent(pluginOptions.enableFallbackComponent);
  }
  if (pluginOptions.customFallbackComponent) {
    setCustomFallbackComponent(pluginOptions.customFallbackComponent);
  }

  return () => storyblokApi;
};

export { getComponent, getCustomFallbackComponent, getEnableFallbackComponent, setComponents };
export { useStoryblokApi as getStoryblokApi };
