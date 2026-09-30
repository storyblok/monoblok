import type { StoryblokBlockComponentProps } from "@storyblok/react";
import { StoryblokBlock } from "@/lib/storyblok";
import type { Block } from "@/schema/blocks";

type GridProps = StoryblokBlockComponentProps<Block<"grid">>;

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
