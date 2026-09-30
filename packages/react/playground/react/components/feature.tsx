import type { StoryblokBlockComponentProps } from "@storyblok/react";

type FeatureProps = StoryblokBlockComponentProps<{
  name: string;
  description: string;
}>;

const Feature = ({ block, editable }: FeatureProps) => (
  <div {...editable} data-test="feature">
    <div>{block.name}</div>
    <p>{block.description}</p>
  </div>
);

export default Feature;
