import type { BlockContent } from "@storyblok/react";

const FallbackComponent = ({ block }: { block: BlockContent }) => (
  <p>
    This is a custom fallback component that we want to show in case a React Component was not
    created for block <strong>{block.component}</strong>.
  </p>
);

export default FallbackComponent;
