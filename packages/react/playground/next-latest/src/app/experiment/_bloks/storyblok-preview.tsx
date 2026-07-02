'use client';

// REAL — app-level live-preview wrapper. Mirrors Dipankar's pattern:
// https://github.com/dipankarmaikap/storyblok-react-sdk/blob/main/playground/nextjs-app-router/app/lib/StoryblokPreview.tsx
//
// Must be defined in the app (not the SDK) because it imports the app's
// registry. Functions can't cross the server→client boundary as props, so
// the client side imports `storyblok` directly from the registry module.
import type { Story } from '../_sdk/types';
import { useStoryblokPreview } from '../_sdk/use-storyblok-preview';
import { storyblok } from './registry';

export function StoryblokPreview({ story }: { story: Story | null }) {
  const liveStory = useStoryblokPreview(story);
  if (!liveStory) return null;
  return <storyblok.StoryblokComponent blok={liveStory.content} />;
}
