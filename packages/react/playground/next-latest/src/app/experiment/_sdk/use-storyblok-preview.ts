'use client';

// REAL — Dipankar's live-preview hook, adapted to subscribe to the stub bridge
// instead of @storyblok/live-preview. The contract is identical:
//   (story) => void  callback, returns a () => void cleanup.
// Drop-in swap: change the import below to:
//   import { onStoryblokEditorEvent } from '@storyblok/live-preview';
// Source: https://github.com/dipankarmaikap/storyblok-react-sdk/blob/main/packages/react/src/use-storyblok-preview.ts
import { useEffect, useState } from 'react';
import type { Story } from './types';
import { subscribeToLivePreview } from '../_stub/bridge';

export function useStoryblokPreview(story: Story | null): Story | null {
  const [bridgeStory, setBridgeStory] = useState<Story | null>(story);
  const storyId = story?.id ?? null;

  useEffect(() => {
    const unsubscribe = subscribeToLivePreview((updated) => {
      setBridgeStory(updated);
    });
    return unsubscribe;
  }, [storyId]);

  return bridgeStory?.id === storyId ? bridgeStory : story;
}
