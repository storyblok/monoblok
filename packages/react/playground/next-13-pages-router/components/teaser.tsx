import type { StoryblokBlockComponentProps } from "@storyblok/react";

type TeaserProps = StoryblokBlockComponentProps<{ headline: string }>;

const Teaser = ({ block, editable }: TeaserProps) => (
  <div {...editable} data-test="teaser">
    <h2>{block.headline}</h2>
  </div>
);

export default Teaser;
