import type { StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import type { Block } from "@/schema/blocks";

type TeaserProps = StoryblokComponentProps<Block<"teaser">>;

const Teaser = ({ block }: TeaserProps) => (
  <div {...storyblokEditable(block)} data-test="teaser">
    <h2>{block.headline}</h2>
  </div>
);

export default Teaser;
