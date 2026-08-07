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

export interface StoryblokBridgeEvent {
  action: string;
  storyId: number;
  story: ISbStoryData;
}

/**
 * Normalises StoryblokBridgeConfigV2 options for the bundled
 * @storyblok/preview-bridge constructor, which has a slightly different
 * BridgeParams shape than the legacy CDN bridge.
 *
 * Changes applied:
 * - `resolveRelations` string → string[] (CDN bridge accepted both; bundled
 *    bridge only accepts string[])
 * - `language` → removed with a deprecation warning (the new bridge receives
 *    language context via the `_storyblok_lang` URL parameter set by the
 *    Visual Editor; it no longer needs to be passed as a constructor option)
 * - `resolveLinks: 'link'` → passed through unchanged. The official docs list
 *    it as a valid value; the TypeScript BridgeParams type omitting it is a
 *    types/docs gap, not a runtime restriction.
 */
function normalizeBridgeOptions(options: StoryblokBridgeConfigV2): Omit<StoryblokBridgeConfigV2, 'language'> {
  const { language, resolveRelations, ...rest } = options;

  if (language) {
    console.warn(
      '[Storyblok] The `language` bridge option is no longer supported by the bundled bridge. '
      + 'Language context is now passed automatically by the Visual Editor via the '
      + '`_storyblok_lang` URL parameter.',
    );
  }

  return {
    ...rest,
    ...(resolveRelations !== undefined && {
      resolveRelations: Array.isArray(resolveRelations)
        ? resolveRelations
        : [resolveRelations],
    }),
  };
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
    const sbBridge: StoryblokBridgeV2 = new window.StoryblokBridge(
      normalizeBridgeOptions(options),
    );
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

  if (bridgeUrl) {
    console.warn(
      '[Storyblok] The `bridgeUrl` option is deprecated and will be removed in a future major version. '
      + 'The Storyblok bridge is now bundled and is no longer loaded from a CDN URL.',
    );
  }

  apiOptions.accessToken = apiOptions.accessToken || accessToken;

  // Initialize plugins
  const options = { bridge, apiOptions };
  let result: SbInitResult = {};

  use.forEach((pluginFactory: any) => {
    result = { ...result, ...pluginFactory(options) };
  });

  /*
  ** Load bridge if you are on the Visual Editor.
  ** For more security: https://www.storyblok.com/faq/how-to-verify-the-preview-query-parameters-of-the-visual-editor
  */
  const isServer = typeof window === 'undefined';
  const inEditor = !isServer && window.location?.search?.includes('_storyblok_tk');
  if (bridge !== false && inEditor) {
    loadBridge();
  }

  return result;
};

export const loadStoryblokBridge = () => loadBridge();

export { useStoryblokBridge as registerStoryblokBridge };

export { default as apiPlugin } from './api';
export { default as storyblokEditable } from './editable';

// Reexport all types so users can have access to them
export * from './types';

export type { BridgeParams } from '@storyblok/preview-bridge';

// Re-exporting same exports from @storyblok/richtext
export { buildStoryblokImage, renderRichText, splitTableRows } from '@storyblok/richtext';

export type {
  SbRichTextDoc,
  SbRichTextImageOptions,
  SbRichTextMark,
  SbRichTextNode,
  SbRichTextProps,
  SbRichTextRenderContext,
  SbRichTextRendererMap,
} from '@storyblok/richtext';

export { default as StoryblokClient } from 'storyblok-js-client';
