import React from "react";
import type { StoryblokBlockData } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

interface FeatureProps {
  block: StoryblokBlockData;
}

const Feature = ({ block }: FeatureProps) => {
  return (
    <div {...storyblokEditable(block)} key={block._uid} data-test="feature">
      <div>
        <div>{block.name as string}</div>
        <p>{block.description as string}</p>
      </div>
    </div>
  );
};

export default Feature;
