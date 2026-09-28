import type { StoryblokComponentProps } from "@storyblok/react";

type GridProps = StoryblokComponentProps;

const Grid = ({ editable }: GridProps) => (
  <h2 data-test="grid" {...editable}>
    This is a Grid component
  </h2>
);

export default Grid;
