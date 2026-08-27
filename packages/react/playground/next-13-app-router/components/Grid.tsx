import type { StoryblokBlockData, StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";

type GridProps = StoryblokComponentProps<{ columns: StoryblokBlockData[] }>;

const Grid = ({ block }: GridProps) => {
  if (!block.columns) return null;

  return (
    <ul data-cy="grid" {...storyblokEditable(block)}>
      {block.columns.map((column) => (
        <li key={column._uid}>
          <StoryblokComponent block={column} />
        </li>
      ))}
    </ul>
  );
};

export default Grid;
