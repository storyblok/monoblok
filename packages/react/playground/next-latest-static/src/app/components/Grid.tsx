import type { BlockContent } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

const Grid = ({ block }: { block: BlockContent }) => (
  <h2 data-cy="grid" {...storyblokEditable(block)}>
    This is a Grid component
  </h2>
);

export default Grid;
