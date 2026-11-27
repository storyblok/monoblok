import type { StoryblokBlockComponentProps } from "@storyblok/react";
import { Block } from "../schema/blocks";

type TeaserProps = StoryblokBlockComponentProps<Block<"teaser">>;

const Teaser = ({ block, editable }: TeaserProps) => (
  <div {...editable} data-test="teaser">
    <h2>{block.headline}</h2>
  </div>
);

export default Teaser;
