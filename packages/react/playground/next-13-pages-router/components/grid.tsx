import type { BlockContent } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "../lib/storyblok";

const Grid = ({ block }: { block: BlockContent }) => (
  <ul {...storyblokEditable(block)} key={block._uid} data-test="grid">
    {(block.columns as BlockContent[]).map((col) => (
      <li key={col._uid}>
        <StoryblokComponent block={col} />
      </li>
    ))}
  </ul>
);

export default Grid;
