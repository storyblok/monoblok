import type { StoryblokRichTextNode, StoryblokRichTextOptions } from '@storyblok/richtext';
import { richTextResolver } from '@storyblok/richtext';
import { loadBridge } from './bridge';
import type {
  ISbEventPayload,
  ISbStoryData,
  SbInitResult,
  SbSDKOptions,
  StoryblokBridgeConfigV2,
  StoryblokBridgeV2,
  StoryblokComponentType,
} from './types';

let bridgeLatest = 'https://app.storyblok.com/f/storyblok-v2-latest.js';

export interface StoryblokBridgeEvent {
  action: string;
  storyId: number;
  story: ISbStoryData;
}

export const useStoryblokBridge = <
  T extends StoryblokComponentType<string> = any,
>(
  id: number,
  cb: (newStory: ISbStoryData<T>) => void,
  options: StoryblokBridgeConfigV2 = {},
) => {
  const isServer = typeof window === 'undefined';
  const isBridgeLoaded
    = !isServer && typeof window.storyblokRegisterEvent !== 'undefined';
  const storyId = new URL(window.location?.href).searchParams.get(
    '_storyblok',
  );
  const inStory = storyId !== null && +storyId === id;

  if (!isBridgeLoaded || !inStory) {
    return;
  }

  if (!id) {
    console.warn('Story ID is not defined. Please provide a valid ID.');
    return;
  }

  window.storyblokRegisterEvent(() => {
    const sbBridge: StoryblokBridgeV2 = new window.StoryblokBridge(options);
    sbBridge.on(['input', 'published', 'change'], (event: ISbEventPayload<T> | undefined) => {
      if (!event) {
        return;
      }
      if (event.action === 'input' && event.story?.id === id) {
        cb(event.story);
      }
      else if (
        (event.action === 'change' || event.action === 'published')
        && (event.storyId as number) === id
      ) {
        window.location.reload();
      }
    });
  });
};

export const storyblokInit = (pluginOptions: SbSDKOptions = {}) => {
  const {
    bridge,
    accessToken,
    use = [],
    apiOptions = {},
    bridgeUrl,
  } = pluginOptions;

  apiOptions.accessToken = apiOptions.accessToken || accessToken;

  // Initialize plugins
  const options = { bridge, apiOptions };
  let result: SbInitResult = {};

  use.forEach((pluginFactory: any) => {
    result = { ...result, ...pluginFactory(options) };
  });

  if (bridgeUrl) {
    bridgeLatest = bridgeUrl;
  }

  /*
  ** Load bridge if you are on the Visual Editor
  ** For more security: https://www.storyblok.com/faq/how-to-verify-the-preview-query-parameters-of-the-visual-editor
  */
  const isServer = typeof window === 'undefined';
  const inEditor = !isServer && window.location?.search?.includes('_storyblok_tk');
  if (bridge !== false && inEditor) {
    loadBridge(bridgeLatest);
  }

  return result;
};

/**
 * Render Rich Text
 * @param data - The rich text data to render
 * @param options - The options for the rich text
 * @returns The rendered rich text
 */
export function renderRichText<T = string>(
  data: StoryblokRichTextNode<T>,
  options?: StoryblokRichTextOptions<T>,
): T | undefined {
  return richTextResolver(options).render(data);
};

export const loadStoryblokBridge = () => loadBridge(bridgeLatest);

export { useStoryblokBridge as registerStoryblokBridge };

export { default as apiPlugin } from './api';
export { default as storyblokEditable } from './editable';

// Reexport all types so users can have access to them
export * from './types';

// New Richtext Resolver
export {
  BlockTypes,
  MarkTypes,
  richTextResolver,
  type StoryblokRichTextDocumentNode,
  type StoryblokRichTextImageOptimizationOptions,
  type StoryblokRichTextNode,
  type StoryblokRichTextNodeResolver,
  type StoryblokRichTextNodeTypes,
  type StoryblokRichTextOptions,
  type StoryblokRichTextResolvers,
  TextTypes,
} from '@storyblok/richtext';
