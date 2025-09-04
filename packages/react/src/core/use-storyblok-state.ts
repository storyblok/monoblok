'use client';

import { useEffect, useState } from 'react';
import type { TUseStoryblokState } from '@/types';
import { registerStoryblokBridge } from '@storyblok/js';

export const useStoryblokState: TUseStoryblokState = (
  initialStory = null,
  bridgeOptions = {},
) => {
  const [story, setStory] = useState(initialStory);

  const storyId = initialStory?.id ?? 0;
  const isBridgeEnabled = typeof window !== 'undefined'
    && typeof window.storyblokRegisterEvent !== 'undefined';

  if (initialStory !== story) {
    setStory(initialStory);
  }

  useEffect(() => {
    if (!isBridgeEnabled || !initialStory) {
      return;
    }

    registerStoryblokBridge(
      storyId,
      newStory => setStory(newStory),
      bridgeOptions,
    );
  }, [initialStory, bridgeOptions]);

  return story;
};
