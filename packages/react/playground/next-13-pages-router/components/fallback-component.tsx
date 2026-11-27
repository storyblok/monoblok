import type { StoryblokBlockComponentProps } from "@storyblok/react";

type FallbackComponentProps = StoryblokBlockComponentProps<{}>;

const FallbackComponent = ({ block }: FallbackComponentProps) => (
  <p>
    Custom fallback for block <strong>{block.component}</strong>.
  </p>
);

export default FallbackComponent;
