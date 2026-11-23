import type { BlockContent, StoryblokBlockComponentProps } from "@storyblok/react";
import { StoryblokBlock } from "../lib/storyblok";

type GridProps = StoryblokBlockComponentProps<{ columns: BlockContent[] }>;

const Grid = ({ block, editable }: GridProps) => (
  <ul {...editable} data-test="grid">
    {block.columns.map((nestedBlock) => (
      <li key={nestedBlock._uid}>
        <StoryblokBlock block={nestedBlock} />
      </li>
    ))}
  </ul>
);

export default Grid;
