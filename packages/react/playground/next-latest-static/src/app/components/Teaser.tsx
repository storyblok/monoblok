import type { StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

type TeaserProps = StoryblokComponentProps<{ headline?: string }>;

const Teaser = ({ block }: TeaserProps) => (
  <h2 data-cy="teaser" {...storyblokEditable(block)}>
    {block.headline}
  </h2>
);

export default Teaser;
