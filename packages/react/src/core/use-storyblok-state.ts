'use client';

import { useEffect, useState } from 'react';
import type { TUseStoryblokState } from '@/types';
import { registerStoryblokBridge } from '@storyblok/js';

export const useStoryblokState: TUseStoryblokState = (
  story = null,
  bridgeOptions = {},
) => {
  const [bridgeStory, setBridgeStory] = useState(null);

  const storyId = story?.id ?? null;
  // If the incoming story changes (e.g. route change), updates for the previous
  // story are not relevant anymore, so we reset the bridge story.
  useEffect(() => {
    setBridgeStory(null);
  }, [storyId]);

  useEffect(() => {
    const isBridgeEnabled = typeof window !== 'undefined'
      && typeof window.storyblokRegisterEvent !== 'undefined';

    if (!isBridgeEnabled || !storyId) {
      return;
    }

    registerStoryblokBridge(
      storyId,
      newStory => setBridgeStory(newStory),
      bridgeOptions,
    );
  }, [storyId, bridgeOptions]);

  // Make sure to only return the `bridgeStory` when it matches the original
  // `story`. If it doesn't match, it means the user has navigated away from the
  // previous `story` and the `bridgeStory` is stale.
  const currentStory = bridgeStory && bridgeStory.id === storyId
    ? bridgeStory
    : story;

  return currentStory;
};
