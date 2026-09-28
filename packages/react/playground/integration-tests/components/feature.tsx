import type { StoryblokComponentProps } from "@storyblok/react";
import { Block } from "../schema/blocks";

type FeatureProps = StoryblokComponentProps<Block<"feature">>;

const Feature = ({ block, editable }: FeatureProps) => (
  <div {...editable} data-test="feature">
    <div>{block.name}</div>
    <p>{block.description}</p>
  </div>
);

export default Feature;
