import { forwardRef } from "react";
import type { ISbStoryData, StoryblokBridgeConfigV2 } from "@/types";
import StoryblokServerComponent from "../server/server-component";
import { toLiveEditRenderProps } from "./live-edit-props";
import { renderLiveEditStory } from "./live-edit-render-action";
import StoryblokLiveEditing from "./live-editing";

interface StoryblokStoryProps extends Omit<Record<string, unknown>, "story" | "bridgeOptions"> {
  story: ISbStoryData;
  bridgeOptions?: StoryblokBridgeConfigV2;
}

const StoryblokStory = forwardRef<HTMLElement, StoryblokStoryProps>(
  ({ story, bridgeOptions, ...restProps }: StoryblokStoryProps, ref) => {
    if (!story) {
      console.error("Please provide a 'story' property to the StoryblokServerComponent");
      return null;
    }

    if (typeof story.content === "string") {
      try {
        story.content = JSON.parse(story.content);
      } catch (error) {
        console.error("An error occurred while trying to parse the story content", error);
        story.content = {};
      }
    }

    // The Server Action is passed from this Server Component (instead of being
    // imported by the client component) so it runs in the same module graph as
    // the app's `storyblokInit`, where the registered components live.
    return (
      <StoryblokLiveEditing
        story={story}
        bridgeOptions={bridgeOptions}
        renderAction={renderLiveEditStory}
        renderProps={toLiveEditRenderProps(restProps)}
      >
        <StoryblokServerComponent ref={ref} blok={story.content} {...restProps} />
      </StoryblokLiveEditing>
    );
  },
);

export default StoryblokStory;
