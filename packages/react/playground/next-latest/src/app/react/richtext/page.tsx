import { StoryblokPreviewRsc } from "@storyblok/react/client";
import type { StoryblokBlockData } from "@storyblok/react";
import { renderRichtextContent } from "@/lib/actions";
import { apiClient, StoryblokRichText } from "@/lib/storyblok";

export default async function RichtextPage() {
  const result = await apiClient.stories.get("richtext", { query: { version: "draft" } });
  const story = result.data?.story;

  if (!story) return <div>Story not found.</div>;

  const content = story.content as StoryblokBlockData;

  return (
    <StoryblokPreviewRsc renderContent={renderRichtextContent}>
      <div>
        <h1>Rich Text Example</h1>
        {content.richText ? (
          <StoryblokRichText document={content.richText as never} />
        ) : (
          <p>No rich text content available.</p>
        )}
      </div>
    </StoryblokPreviewRsc>
  );
}
