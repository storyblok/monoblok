import type { StoryblokBlockData } from "@storyblok/react";
import { StoryblokPreview } from "@storyblok/react/client";
import { useStory } from "../hooks/use-story";
import { StoryblokComponent } from "../storyblok";

function Home() {
  const { data: story, error } = useStory("react");

  if (error) return <div>Failed to load story.</div>;
  if (!story) return <div>Loading...</div>;

  return (
    <StoryblokPreview story={story}>
      {(live) => (
        <div>
          <h1>Home</h1>
          <StoryblokComponent block={live.content} />
        </div>
      )}
    </StoryblokPreview>
  );
}

export default Home;
