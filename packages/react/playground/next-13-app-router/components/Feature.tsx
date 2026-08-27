import type { StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

type FeatureProps = StoryblokComponentProps<{
  name: string;
  description: string;
}>;

const Feature = ({ block }: FeatureProps) => (
  <div data-cy="feature" {...storyblokEditable(block)}>
    <div>{block.name}</div>
    <p>{block.description}</p>
  </div>
);

export default Feature;
