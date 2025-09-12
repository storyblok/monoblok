'use client';

import { loadStoryblokBridge, registerStoryblokBridge } from '@storyblok/js';
import type { ISbStoryData, StoryblokBridgeConfigV2 } from '@storyblok/js';
import { startTransition, useEffect } from 'react';
import { isBridgeLoaded, isVisualEditor } from '../utils';

const StoryblokLiveEditing = ({ story = null, bridgeOptions = {} }: { story: ISbStoryData; bridgeOptions?: StoryblokBridgeConfigV2 }) => {
  const inVisualEditor = isVisualEditor();

  if (!inVisualEditor) {
    return null;
  }

  const storyId = story?.id ?? 0;
  useEffect(() => {
    (async () => {
      // In RSC environments, Storyblok components are server-side rendered,
      // so the bridge script is never automatically loaded on the client.
      // We need to explicitly load it here for live editing to work.
      if (!isBridgeLoaded()) {
        await loadStoryblokBridge();
      }

      const handleInput = async (story: ISbStoryData) => {
        if (!story) {
          return;
        }

        try {
          const { liveEditUpdateAction } = await import('./live-edit-update-action');

          startTransition(() => {
            liveEditUpdateAction({ story, pathToRevalidate: window.location.pathname });
          });
        }
        catch (error) {
          // Fallback: just cache the story if server action is not available
          console.warn('Server action not available, caching story locally:', error);
          if (story.uuid) {
            globalThis.storyCache?.set(story.uuid, story);
          }
        }
      };

      registerStoryblokBridge(storyId, newStory => handleInput(newStory), bridgeOptions);
    })();
  }, [storyId, JSON.stringify(bridgeOptions)]);

  return null;
};

export default StoryblokLiveEditing;
