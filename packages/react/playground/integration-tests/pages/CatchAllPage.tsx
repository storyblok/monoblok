import { useParams } from "react-router";
import { StoryblokPreview } from "@storyblok/react";
import { useStoryblokStory } from "../hooks/use-story";
import { StoryblokComponent } from "../storyblok";

function CatchAllPage() {
  const params = useParams();
  const slug = params["*"] || "home";
  const { data: story, error } = useStoryblokStory(slug);
  if (error) return <div>Failed to load story.</div>;
  if (!story) return <div>Loading...</div>;
  if (story.content?.component !== "page") return <div>Unsupported story.</div>;

  return (
    <div>
      <StoryblokPreview
        story={story}
        bridgeOptions={{ resolveRelations: ["featured-articles.posts"] }}
        renderContent={(live) => (
          <div data-test="live">
            {live.content ? <StoryblokComponent block={live.content} /> : null}
          </div>
        )}
      />
      {/*
        Bridge-disabled, on purpose: renders the story fetched on mount
        directly, never through `StoryblokPreview`/`useStoryblokState`, so it
        never subscribes to editor events. Proves the bridge is opt-in per
        call, not a page-wide default — an editor `input` event has no
        subscription to replace here.
      */}
      {story.content.body?.map((block) =>
        block.component === "teaser" ? (
          <p key={block._uid} data-test="static-teaser-headline">
            {block.headline}
          </p>
        ) : null,
      )}
    </div>
  );
}

export default CatchAllPage;
