"use client";

import { useState } from "react";
import type { LivePreviewStory } from "@storyblok/live-preview";
import type { Story } from "../types";
import {
  useStoryblokEditorEvent,
  type UseStoryblokEditorEventOptions,
} from "./use-storyblok-editor-event";

/** Options for {@link useStoryblokState}. */
export interface UseStoryblokStateOptions extends UseStoryblokEditorEventOptions {}

interface StoryblokStateSnapshot<TStory extends Story> {
  /** The prop value this snapshot was derived from — used to detect a real prop change. */
  story: TStory;
  /** The value returned to the caller: the prop, or a live-edited version of it. */
  current: LivePreviewStory<TStory>;
}

/**
 * Whether two stories represent the same data: same reference, or same id and
 * deep-equal content. Value equality (rather than reference equality) means a
 * parent re-render that creates a fresh-but-identical story object does not
 * count as a prop change.
 */
function isSameStory(a: Story, b: Story): boolean {
  return a === b || (a.id === b.id && JSON.stringify(a) === JSON.stringify(b));
}

/**
 * Subscribes to Storyblok Visual Editor events and returns the latest story.
 *
 * Pass the initially fetched story (from your server component, route loader,
 * or data-fetching hook). On every editor update the returned value is replaced
 * with the updated story — triggering a re-render of the calling component.
 *
 * @example
 * ```tsx
 * "use client";
 * function Page({ story }: { story: Story }) {
 *   const live = useStoryblokState(story);
 *   return live.content ? <StoryblokComponent block={live.content} /> : null;
 * }
 * ```
 */
export function useStoryblokState<TStory extends Story = Story>(
  story: TStory,
  options: UseStoryblokStateOptions = {},
): LivePreviewStory<TStory> {
  const [snapshot, setSnapshot] = useState<StoryblokStateSnapshot<TStory>>(() => ({
    story,
    current: story,
  }));

  // Derive state during render instead of syncing in an effect. An effect
  // commits one render late — a prop change from story A to story B would
  // paint A once before catching up — and it fires on every new-but-equal
  // object a parent re-render creates, wiping any live edit in progress.
  // Comparing by value means a genuinely new object with the same content
  // doesn't reset an in-progress edit, while a real prop change (a different
  // id, or the same id refreshed with new data) still does.
  if (!isSameStory(story, snapshot.story)) {
    setSnapshot({ story, current: story });
  }

  useStoryblokEditorEvent<TStory>((updatedStory) => {
    // Editor `input` events aren't scoped to one story: without this guard, a
    // page preview and a nav preview mounted on the same layout would both
    // take whichever story is being edited.
    if (updatedStory.id !== story.id) {
      return;
    }
    setSnapshot((prev) => ({ ...prev, current: { ...prev.current, ...updatedStory } }));
  }, options);

  return snapshot.current;
}
