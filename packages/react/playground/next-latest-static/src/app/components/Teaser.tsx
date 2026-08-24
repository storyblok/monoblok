import type { BlockContent } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

const Teaser = ({ block }: { block: BlockContent & { headline?: string } }) => (
  <h2 data-cy="teaser" {...storyblokEditable(block)}>
    {block.headline}
  </h2>
);

export default Teaser;
