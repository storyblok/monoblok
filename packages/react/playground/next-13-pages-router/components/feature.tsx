import type { StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

type FeatureProps = StoryblokComponentProps<{
  name: string;
  description: string;
}>;

const Feature = ({ block }: FeatureProps) => (
  <div {...storyblokEditable(block)} data-test="feature">
    <div>{block.name}</div>
    <p>{block.description}</p>
  </div>
);

export default Feature;
