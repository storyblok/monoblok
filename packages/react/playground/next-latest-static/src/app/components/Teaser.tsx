import type { StoryblokComponentProps } from "@storyblok/react";

type TeaserProps = StoryblokComponentProps<{ headline?: string }>;

const Teaser = ({ block, editable }: TeaserProps) => (
  <h2 data-test="teaser" {...editable}>
    {block.headline}
  </h2>
);

export default Teaser;
