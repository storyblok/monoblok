import { storyblokEditable } from "@storyblok/react";
import type { StoryblokBlockData } from "@storyblok/react";

interface TeaserProps {
  block: StoryblokBlockData & {
    headline?: string;
  };
}

const Teaser = ({ block }: TeaserProps) => {
  return (
    <h2 data-cy="teaser" {...storyblokEditable(block)}>
      {block.headline}
    </h2>
  );
};

export default Teaser;
