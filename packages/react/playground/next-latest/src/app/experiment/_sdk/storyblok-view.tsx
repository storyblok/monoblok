// REAL — the RSC entry point. Renders the story once on the server; in live
// preview it mounts the client island that re-renders on each bridge event.
import type { ReactNode } from 'react';
import { LivePreviewIsland } from './live-preview-island';
import type { Story } from './types';

type Props = {
  story: Story;
  render: (story: Story) => Promise<ReactNode>;
  livePreview: boolean;
};

export async function StoryblokView({ story, render, livePreview }: Props) {
  const initial = await render(story);

  if (!livePreview) {
    return <>{initial}</>;
  }

  return <LivePreviewIsland initial={initial} render={render} />;
}
