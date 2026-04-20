'use client';

import { type ISbStoryData, loadStoryblokBridge, registerStoryblokBridge, type StoryblokBridgeConfigV2 } from '@storyblok/js';
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

      const handleInput = async (incoming: ISbStoryData) => {
        if (!incoming) {
          return;
        }

        // Visual History picks arrive as minimal `{ id, content }` payloads
        // without a uuid. Key the cache by id so the server re-render can find
        // them after revalidatePath returns the draft (which has a different
        // uuid).
        const isHistoryEvent = !incoming.uuid && typeof incoming.id === 'number';
        const cacheKey = isHistoryEvent ? `id:${incoming.id}` : undefined;

        try {
          const { liveEditUpdateAction } = await import('./live-edit-update-action');

          startTransition(() => {
            liveEditUpdateAction({
              story: incoming,
              pathToRevalidate: window.location.pathname,
              cacheKey,
            });
          });
        }
        catch (error) {
          // Fallback: just cache the story if server action is not available
          console.warn('Server action not available, caching story locally:', error);
          const fallbackKey = cacheKey ?? incoming.uuid;
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
