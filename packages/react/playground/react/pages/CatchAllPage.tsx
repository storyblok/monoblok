import { useParams } from "react-router";
import { StoryblokPreview } from "@storyblok/react/client";
import { useStory } from "../hooks/use-story";
import { StoryblokComponent } from "../storyblok";

function CatchAllPage() {
  const params = useParams();
  const slug = params["*"] || "react";
  const { data: story, error } = useStory(slug);
  if (error) return <div>Failed to load story.</div>;
  if (!story) return <div>Loading...</div>;

  return (
    <StoryblokPreview key={story.uuid} story={story}>
      {(live) => (
        <div>
          <StoryblokComponent block={live.content} />
        </div>
      )}
    </StoryblokPreview>
  );
}

export default CatchAllPage;
