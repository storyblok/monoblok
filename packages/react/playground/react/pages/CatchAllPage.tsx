import { useParams } from "react-router";
import { StoryblokPreview } from "@storyblok/react";
import { useStoryblokStory } from "../hooks/use-story";
import { StoryblokComponent } from "../storyblok";
import type { BlockContent } from "@storyblok/react";

function CatchAllPage() {
  const params = useParams();
  const slug = params["*"] || "react";
  const { data: story, error } = useStoryblokStory(slug);
  if (error) return <div>Failed to load story.</div>;
  if (!story) return <div>Loading...</div>;

  return (
    <StoryblokPreview
      key={story.uuid}
      story={story}
      renderContent={(live) => (
        <div>
          <StoryblokComponent block={live.content as BlockContent} />
        </div>
      )}
    />
  );
}

export default CatchAllPage;
