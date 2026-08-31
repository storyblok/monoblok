import type { BlockContent, StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "../lib/storyblok";

type GridProps = StoryblokComponentProps<{ columns: BlockContent[] }>;

const Grid = ({ block }: GridProps) => (
  <ul {...storyblokEditable(block)} data-test="grid">
    {block.columns.map((nestedBlock) => (
      <li key={nestedBlock._uid}>
        <StoryblokComponent block={nestedBlock} />
      </li>
    ))}
  </ul>
);

export default Grid;
