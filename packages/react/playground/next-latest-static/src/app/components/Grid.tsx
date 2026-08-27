import type { StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

type GridProps = StoryblokComponentProps<object>;

const Grid = ({ block }: GridProps) => (
  <h2 data-cy="grid" {...storyblokEditable(block)}>
    This is a Grid component
  </h2>
);

export default Grid;
