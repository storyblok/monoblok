import type { StoryblokBlockComponentProps } from "@storyblok/react";

type TeaserProps = StoryblokBlockComponentProps<{ headline?: string }>;

const Teaser = ({ block, editable }: TeaserProps) => (
  <h2 data-test="teaser" {...editable}>
    {block.headline}
  </h2>
);

export default Teaser;
