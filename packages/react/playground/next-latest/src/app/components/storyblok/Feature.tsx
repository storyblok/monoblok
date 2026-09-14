import type { StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

type FeatureProps = StoryblokComponentProps<{
  name: string;
  description: string;
  color: {
    _uid: string;
    color: string;
    plugin: "native-color-picker";
  };
}>;

const Feature = ({ block }: FeatureProps) => (
  <div
    data-test="feature"
    style={{ backgroundColor: block.color.color, padding: "8px" }}
    {...storyblokEditable(block)}
  >
    <h2>{block.name}</h2>
    <p>{block.description}</p>
  </div>
);

export default Feature;
