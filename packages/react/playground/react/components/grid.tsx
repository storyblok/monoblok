import React from "react";
import type { BlockContent } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "../lib/storyblok";

interface GridProps {
  block: BlockContent;
}

const Grid = ({ block }: GridProps) => (
  <ul {...storyblokEditable(block)} key={block._uid} data-test="grid">
    {(block.columns as BlockContent[]).map((col) => (
      <li key={col._uid}>
        <StoryblokComponent block={col} />
      </li>
    ))}
  </ul>
);

export default Grid;
