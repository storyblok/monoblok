import type { StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

type TeaserProps = StoryblokComponentProps<{ headline: string }>;

const Teaser = ({ block }: TeaserProps) => (
  <div {...storyblokEditable(block)} data-test="teaser">
    <h2>{block.headline}</h2>
  </div>
);

export default Teaser;
