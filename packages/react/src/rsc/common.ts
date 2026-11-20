import { storyblokInit as sbInit } from '@storyblok/js';
import type {
  SbReactSDKOptions,
  StoryblokClient,
} from '@/types';
import {
  getComponent,
  getCustomFallbackComponent,
  getEnableFallbackComponent,
  setComponents,
  setCustomFallbackComponent,
  setEnableFallbackComponent,
} from './state';

let storyblokApiInstance: StoryblokClient = null;

export const useStoryblokApi = (): StoryblokClient => {
  if (!storyblokApiInstance) {
    console.error(
      'You can\'t use getStoryblokApi if you\'re not loading apiPlugin.',
    );
  }

  return storyblokApiInstance;
};

export { getComponent, getCustomFallbackComponent, getEnableFallbackComponent, setComponents };

export const storyblokInit = (pluginOptions: SbReactSDKOptions = {}): (() => StoryblokClient) => {
  if (storyblokApiInstance) {
    return () => storyblokApiInstance;
  }

  const { storyblokApi } = sbInit(pluginOptions);
  storyblokApiInstance = storyblokApi;

  if (pluginOptions.components) {
    setComponents(pluginOptions.components);
  }
  setEnableFallbackComponent(pluginOptions.enableFallbackComponent);
  setCustomFallbackComponent(pluginOptions.customFallbackComponent);

  return () => storyblokApi;
};

export * from '../types';
export { useStoryblokApi as getStoryblokApi };
export { default as StoryblokServerComponent } from './server-component';

export {
  apiPlugin,
  loadStoryblokBridge,
  registerStoryblokBridge,
  renderRichText,
  RichTextResolver,
  RichTextSchema,
  storyblokEditable,
  useStoryblokBridge,
} from '@storyblok/js';
