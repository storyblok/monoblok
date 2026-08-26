import type { StoryblokBlockData } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

interface TeaserProps {
  block: StoryblokBlockData & { headline: string };
}

const Teaser = ({ block }: TeaserProps) => (
  <h2 data-cy="teaser" {...storyblokEditable(block)}>
    {block.headline}
  </h2>
);

export default Teaser;
