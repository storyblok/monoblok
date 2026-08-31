import type { BlockContent, StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "../storyblok";

type GridProps = StoryblokComponentProps<{ columns: BlockContent[] }>;

const Grid = ({ block }: GridProps) => {
  if (!block.columns) {
    return null;
  }

  return (
    <ul {...storyblokEditable(block)} data-test="grid">
      {block.columns.map((nestedBlock) => (
        <li key={nestedBlock._uid}>
          <StoryblokComponent block={nestedBlock} />
        </li>
      ))}
    </ul>
  );
};

export default Grid;
