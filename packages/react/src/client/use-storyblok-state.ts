"use client";

import { useState } from "react";
import type { Story } from "../types";
import { useEditorEvent, type UseStoryblokEditorEventOptions } from "./use-storyblok-editor-event";

/** Options for {@link useStoryblokState}. */
export type UseStoryblokStateOptions = UseStoryblokEditorEventOptions;

type StoryblokStateSnapshot<TStory extends Story> = {
  /** The prop value this snapshot was derived from — used to detect a real prop change. */
  story: TStory;
  /**
   * The value returned to the caller: the prop, or a live-edited version of
   * it. Editor updates are merged over the prop, so every field the prop has
   * is still there.
   */
  current: TStory;
};

/**
 * Structural equality for JSON-shaped values (primitives, arrays, plain
 * objects). Ignores object key order, unlike comparing `JSON.stringify`
 * output, and stops at the first difference.
 *
 * Handles circular values: `@storyblok/api-client` with `inlineRelations`
 * returns stories whose related stories can reference each other. A pair
 * already being compared counts as equal, since any difference inside it is
 * found where its comparison started.
 */
function isDeepEqual(a: unknown, b: unknown, seen = new WeakMap<object, Set<object>>()): boolean {
  if (a === b) {
    return true;
  }
  if (!isRecord(a) || !isRecord(b)) {
    return false;
  }
  const seenWithA = seen.get(a);
  if (seenWithA?.has(b)) {
    return true;
  }
  if (seenWithA) {
    seenWithA.add(b);
  } else {
    seen.set(a, new Set([b]));
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => isDeepEqual(item, b[index], seen))
    );
  }
  const aKeys = Object.keys(a);
  return (
    aKeys.length === Object.keys(b).length &&
    aKeys.every(
      (key) => Object.prototype.hasOwnProperty.call(b, key) && isDeepEqual(a[key], b[key], seen),
    )
  );
}

function isRecord(value: unknown): value is Record<string | number, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Whether two stories represent the same data: same reference, or same id and
 * deep-equal content. Value equality (rather than reference equality) means a
 * parent re-render that creates a fresh-but-identical story object, even with
 * its keys in a different order, does not count as a prop change.
 */
function isSameStory(a: Story, b: Story): boolean {
  return a === b || (a.id === b.id && isDeepEqual(a, b));
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
 *   return live.content ? <StoryblokBlock block={live.content} /> : null;
 * }
 * ```
 */
export function useStoryblokState<TStory extends Story = Story>(
  story: TStory,
  options: UseStoryblokStateOptions = {},
): TStory {
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

  // `storyId` scopes editor events to this story: without it, a page preview
  // and a nav preview mounted on the same layout would both take whichever
  // story is being edited.
  useEditorEvent<TStory>(
    (updatedStory) => {
      // `storyId` is synced after commit, so an event can still slip through
      // between a navigation render and that sync. Only merge into the story
      // the snapshot currently holds.
      setSnapshot((prev) =>
        prev.story.id === updatedStory.id
          ? { ...prev, current: { ...prev.current, ...updatedStory } }
          : prev,
      );
    },
    { ...options, storyId: story.id },
  );

  return snapshot.current;
}
