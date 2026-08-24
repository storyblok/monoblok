import React from "react";
import type { BlockContent } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

interface FeatureProps {
  block: BlockContent;
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
