import type { BlockContent } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

const Feature = ({ block }: { block: BlockContent }) => (
  <div {...storyblokEditable(block)} key={block._uid} data-test="feature">
    <div>{block.name as string}</div>
    <p>{block.description as string}</p>
  </div>
);

export default Feature;
