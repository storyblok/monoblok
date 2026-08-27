import type { StoryblokComponentProps } from "@storyblok/react";

type FallbackComponentProps = StoryblokComponentProps<{}>;

const FallbackComponent = ({ block }: FallbackComponentProps) => (
  <p>
    Custom fallback for block <strong>{block.component}</strong>.
  </p>
);

export default FallbackComponent;
