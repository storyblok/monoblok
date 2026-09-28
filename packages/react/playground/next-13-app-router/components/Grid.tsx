import type { BlockContent, StoryblokComponentProps } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";

type GridProps = StoryblokComponentProps<{ columns: BlockContent[] }>;

const Grid = ({ block, editable }: GridProps) => {
  if (!block.columns) return null;

  return (
    <ul data-test="grid" {...editable}>
      {block.columns.map((column) => (
        <li key={column._uid}>
          <StoryblokComponent block={column} />
        </li>
      ))}
    </ul>
  );
};

export default Grid;
