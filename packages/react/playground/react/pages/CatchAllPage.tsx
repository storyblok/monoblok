import { useParams } from "react-router";
import { StoryblokPreview } from "@storyblok/react/client";
import { StoryblokComponent } from "../lib/storyblok";
import { useStoryblokStory } from "../lib/use-storyblok-story";

function CatchAllPage() {
  const params = useParams();
  const slug = params["*"] || "react";

  const { data: story, isLoading } = useStoryblokStory(slug);

  if (isLoading || !story) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Catch All Page</h1>
      <StoryblokPreview story={story}>
        {(live) => <StoryblokComponent block={live.content} />}
      </StoryblokPreview>
    </div>
  );
}

export default CatchAllPage;
