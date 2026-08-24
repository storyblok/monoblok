import { StoryblokPreview } from "@storyblok/react/client";
import { StoryblokComponent } from "../lib/storyblok";
import { useStoryblokStory } from "../lib/use-storyblok-story";

function Home() {
  const { data: story, isLoading } = useStoryblokStory("react");

  if (isLoading || !story) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Home</h1>
      <StoryblokPreview story={story}>
        {(live) => <StoryblokComponent block={live.content} />}
      </StoryblokPreview>
    </div>
  );
}

export default Home;
