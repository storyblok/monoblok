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

export * from '../types';

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

export { useStoryblokApi as getStoryblokApi };

export { default as StoryblokComponent } from './storyblok-component';

export {
  apiPlugin,
  BlockTypes,
  loadStoryblokBridge,
  MarkTypes,
  registerStoryblokBridge,
  renderRichText,
  richTextResolver,
  storyblokEditable,
  type StoryblokRichTextImageOptimizationOptions,
  type StoryblokRichTextNode,
  type StoryblokRichTextNodeResolver,
  type StoryblokRichTextNodeTypes,
  type StoryblokRichTextOptions,
  type StoryblokRichTextResolvers,
  TextTypes,
  useStoryblokBridge,
} from '@storyblok/js';
