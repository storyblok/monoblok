import type { BlockContent, StoryblokComponentProps } from "@storyblok/react";
import { StoryblokComponent } from "../storyblok";

type GridProps = StoryblokComponentProps<{ columns: BlockContent[] }>;

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
