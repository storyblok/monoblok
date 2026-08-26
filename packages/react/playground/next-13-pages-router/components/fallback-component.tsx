import type { StoryblokBlockData } from "@storyblok/react";

const FallbackComponent = ({ block }: { block: StoryblokBlockData }) => (
  <p>
    Custom fallback for block <strong>{block.component}</strong>.
  </p>
);

export default FallbackComponent;
