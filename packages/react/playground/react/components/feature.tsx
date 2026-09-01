import type { StoryblokComponentProps } from "@storyblok/react";

type FeatureProps = StoryblokComponentProps<{
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
