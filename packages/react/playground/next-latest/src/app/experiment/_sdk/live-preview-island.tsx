'use client';

// REAL — the client island. Subscribes to live-preview updates and re-invokes
// the `render` server action for each new story, swapping the returned RSC
// payload into a stable state slot. Client islands inside the payload keep
// their position and type across swaps, so React reconciles them in place and
// their local state survives.
//
// The ONLY stubbed seam here is the import of `subscribeToLivePreview`. In
// production it is `onStoryblokEditorEvent` from `@storyblok/live-preview`,
// which has the same `(story) => void` callback / cleanup contract.
import { useEffect, useState, type ReactNode } from 'react';
import { subscribeToLivePreview } from '../_stub/bridge';
import type { Story } from './types';

type Props = {
  initial: ReactNode;
  render: (story: Story) => Promise<ReactNode>;
};

export function LivePreviewIsland({ initial, render }: Props) {
  const [payload, setPayload] = useState<ReactNode>(initial);

  useEffect(() => {
    const unsubscribe = subscribeToLivePreview(async (story) => {
      setPayload(await render(story));
    });
    return unsubscribe;
  }, [render]);

  return <div data-testid="payload-slot">{payload}</div>;
}
