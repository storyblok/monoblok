import type { StoryblokBlockData } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

const Teaser = ({ block }: { block: StoryblokBlockData }) => (
  <div {...storyblokEditable(block)} key={block._uid} data-test="teaser">
    <h2>{block.headline as string}</h2>
  </div>
);

export default Teaser;
