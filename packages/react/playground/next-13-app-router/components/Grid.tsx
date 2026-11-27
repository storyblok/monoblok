import type { BlockContent, StoryblokBlockComponentProps } from "@storyblok/react";
import { StoryblokBlock } from "@/lib/storyblok";

type GridProps = StoryblokBlockComponentProps<{ columns: BlockContent[] }>;

const Grid = ({ block, editable }: GridProps) => {
  if (!block.columns) return null;

  return (
    <ul data-test="grid" {...editable}>
      {block.columns.map((column) => (
        <li key={column._uid}>
          <StoryblokBlock block={column} />
        </li>
      ))}
    </ul>
  );
};

export default Grid;
