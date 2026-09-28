import type { StoryblokComponentProps } from "@storyblok/react";

type TeaserProps = StoryblokComponentProps<{ headline: string }>;

const Teaser = ({ block, editable }: TeaserProps) => (
  <div {...editable} data-test="teaser">
    <h2>{block.headline}</h2>
  </div>
);

export default Teaser;
