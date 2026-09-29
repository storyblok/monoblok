import type { BlockContent, StoryblokBlockComponentProps } from "@storyblok/react";
import { StoryblokBlock } from "../storyblok";

type GridProps = StoryblokBlockComponentProps<{ columns: BlockContent[] }>;

const Grid = ({ block, editable }: GridProps) => {
  if (!block.columns) {
    return null;
  }

  return (
    <ul {...editable} data-test="grid">
      {block.columns.map((nestedBlock) => (
        <li key={nestedBlock._uid}>
          <StoryblokBlock block={nestedBlock} />
        </li>
      ))}
    </ul>
  );
};

export default Grid;
