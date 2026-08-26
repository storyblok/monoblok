import type { StoryblokBlockData } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "../lib/storyblok";

const Grid = ({ block }: { block: StoryblokBlockData }) => (
  <ul {...storyblokEditable(block)} key={block._uid} data-test="grid">
    {(block.columns as StoryblokBlockData[]).map((nestedBlock) => (
      <li key={nestedBlock._uid}>
        <StoryblokComponent block={nestedBlock} />
      </li>
    ))}
  </ul>
);

export default Grid;
