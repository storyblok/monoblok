'use client';

import { type ISbStoryData, loadStoryblokBridge, registerStoryblokBridge, type StoryblokBridgeConfigV2 } from '@storyblok/js';
import { startTransition, useEffect } from 'react';
import { liveEditUpdateAction } from './live-edit-update-action';
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

      const handleInput = (story: ISbStoryData) => {
        if (!story) {
          return;
        }
        startTransition(() => {
          liveEditUpdateAction({ story, pathToRevalidate: window.location.pathname });
        });
      };

      registerStoryblokBridge(storyId, newStory => handleInput(newStory), bridgeOptions);
    })();
  }, [storyId, JSON.stringify(bridgeOptions)]);

  return null;
};

export default StoryblokLiveEditing;
