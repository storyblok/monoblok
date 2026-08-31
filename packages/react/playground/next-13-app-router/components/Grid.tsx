import type { BlockContent, StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";

type GridProps = StoryblokComponentProps<{ columns: BlockContent[] }>;

const Grid = ({ block }: GridProps) => {
  if (!block.columns) return null;

  return (
    <ul data-test="grid" {...storyblokEditable(block)}>
      {block.columns.map((column) => (
        <li key={column._uid}>
          <StoryblokComponent block={column} />
        </li>
      ))}
    </ul>
  );
};

export default Grid;
