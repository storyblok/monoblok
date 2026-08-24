import { StoryblokPreview } from "@storyblok/react/client";
import type { StoryblokRichTextInput } from "@storyblok/react";
import { StoryblokRichText } from "../lib/storyblok";
import { useStoryblokStory } from "../lib/use-storyblok-story";

function RichtextPage() {
  const { data: story, isLoading } = useStoryblokStory("richtext");

  if (isLoading || !story) {
    return <div>Loading...</div>;
  }

  return (
    <StoryblokPreview story={story}>
      {(live) => {
        const richText = live.content.richText as StoryblokRichTextInput | undefined;
        return richText ? <StoryblokRichText document={richText} /> : null;
      }}
    </StoryblokPreview>
  );
}

export default RichtextPage;
