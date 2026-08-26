import type { StoryblokBlockData } from "@storyblok/react";
import { StoryblokPreview } from "@storyblok/react/client";
import { useStory } from "../hooks/use-story";
import { StoryblokRichText } from "../storyblok";

function RichtextPage() {
  const { data: story, error } = useStory("richtext");

  if (error) return <div>Failed to load story.</div>;
  if (!story) return <div>Loading...</div>;

  return (
    <StoryblokPreview story={story}>
      {(live) => {
        const content = live.content as StoryblokBlockData;
        return content.richText ? <StoryblokRichText document={content.richText as never} /> : null;
      }}
    </StoryblokPreview>
  );
}

export default RichtextPage;
