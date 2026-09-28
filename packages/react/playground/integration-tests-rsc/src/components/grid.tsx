import type { StoryblokComponentProps } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";
import type { Block } from "@/schema/blocks";

type GridProps = StoryblokComponentProps<Block<"grid">>;

const Grid = ({ block, editable }: GridProps) => {
  if (!block.columns) {
    return null;
  }

  return (
    <ul {...editable} data-test="grid">
      {block.columns.map((nestedBlock) => (
        <li key={nestedBlock._uid}>
          <StoryblokComponent block={nestedBlock} />
        </li>
      ))}
    </ul>
  );
};

export default Grid;
