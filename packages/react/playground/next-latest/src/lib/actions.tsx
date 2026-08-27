"use server";

import type { Story } from "@storyblok/react";
import type { ReactNode } from "react";
import type { StoryblokBlockData } from "@storyblok/react";
import { StoryblokComponent, StoryblokRichText } from "@/lib/storyblok";

export async function renderContent(story: Story): Promise<ReactNode> {
  return <StoryblokComponent block={story.content} />;
}

export async function renderRichtextContent(story: Story): Promise<ReactNode> {
  const content = story.content as StoryblokBlockData;
  return content.richText ? (
    <StoryblokRichText document={content.richText as never} />
  ) : (
    <p>No rich text content available.</p>
  );
}
