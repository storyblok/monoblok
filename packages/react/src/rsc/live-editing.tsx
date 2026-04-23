'use client';

import { type ISbStoryData, loadStoryblokBridge, registerStoryblokBridge, type StoryblokBridgeConfigV2 } from '@storyblok/js';
import { startTransition, useEffect } from 'react';
import { getStoryCacheKey } from '../core/story-cache';
import { isBridgeLoaded, isVisualEditor } from '../utils';

const StoryblokLiveEditing = ({ story = null, bridgeOptions = {} }: { story: ISbStoryData; bridgeOptions?: StoryblokBridgeConfigV2 }) => {
  const inVisualEditor = isVisualEditor();

  if (!inVisualEditor) {
    return null;
  }

  const storyId = typeof story?.id === 'number' ? story.id : null;
  useEffect(() => {
    if (storyId === null) {
      return;
    }

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

        try {
          const { liveEditUpdateAction } = await import('./live-edit-update-action');

          startTransition(() => {
            liveEditUpdateAction({
              story: incoming,
              pathToRevalidate: window.location.pathname,
            });
          });
        }
        catch (error) {
          // Fallback: just cache the story if server action is not available
          console.warn('Server action not available, caching story locally:', error);
          const fallbackKey = getStoryCacheKey(incoming);
          if (fallbackKey) {
            globalThis.storyCache?.set(fallbackKey, incoming);
          }
        }
      };

      registerStoryblokBridge(storyId, newStory => handleInput(newStory), bridgeOptions);
    })();
  }, [storyId, JSON.stringify(bridgeOptions)]);

  return null;
};

export default StoryblokLiveEditing;
