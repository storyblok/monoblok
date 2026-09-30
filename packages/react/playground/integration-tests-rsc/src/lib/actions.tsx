"use server";

import type { LivePreviewStory } from "@storyblok/react";
import type { ReactNode } from "react";
import { StoryblokBlock } from "@/lib/storyblok";

/**
 * Server Action passed to `StoryblokPreview` (`@storyblok/react/rsc`). Called
 * once for the initial paint and again on every Visual Editor update, so it
 * must stay a plain server-side render — no client-only hooks here.
 *
 * `StoryblokPreview`'s `renderContent` prop is typed against the base `Story`
 * (it has to accept whatever the bridge hands back), not the schema-narrowed
 * one — narrowing it here would make this function un-assignable to that
 * prop's contravariant parameter type.
 */
export async function renderContent(story: LivePreviewStory): Promise<ReactNode> {
  return story.content ? (
    <div data-test="live">
      <StoryblokBlock block={story.content} />
    </div>
  ) : null;
}
