import React from "react";
import type { StoryblokBlockData } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "../storyblok";

interface GridProps {
  block: StoryblokBlockData;
}

const Grid = ({ block }: GridProps) => (
  <ul {...storyblokEditable(block)} key={block._uid} data-test="grid">
    {(block.columns as StoryblokBlockData[]).map((nestedBlock) => (
      <li key={nestedBlock._uid}>
        <StoryblokComponent block={nestedBlock} />
      </li>
    ))}
  </ul>
);

export default Grid;
