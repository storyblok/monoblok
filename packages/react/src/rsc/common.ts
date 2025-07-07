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
} from '../shared/state';

export const useStoryblokApi = (): StoryblokClient => {
  const instance = getStoryblokApiInstance();
  if (!instance) {
    console.error(
      'You can\'t use getStoryblokApi if you\'re not loading apiPlugin.',
    );
  }

  return instance;
};

export { getComponent, getCustomFallbackComponent, getEnableFallbackComponent, setComponents };

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

export * from '../types';
export { useStoryblokApi as getStoryblokApi };

export {
  apiPlugin,
  loadStoryblokBridge,
  registerStoryblokBridge,
  renderRichText,
  storyblokEditable,
  useStoryblokBridge,
} from '@storyblok/js';
