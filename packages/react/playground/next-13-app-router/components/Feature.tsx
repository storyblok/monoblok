import type { StoryblokBlockComponentProps } from "@storyblok/react";

type FeatureProps = StoryblokBlockComponentProps<{
  name: string;
  description: string;
}>;

const Feature = ({ block, editable }: FeatureProps) => (
  <div data-test="feature" {...editable}>
    <div>{block.name}</div>
    <p>{block.description}</p>
  </div>
);

export default Feature;
