import React, { forwardRef } from "react";
import type { BlockContent } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

interface RefCheckerProps {
  block: BlockContent;
}

const RefChecker = forwardRef<HTMLDivElement, RefCheckerProps>(({ block }, ref) => {
  return (
    <div {...storyblokEditable(block)} data-test="ref-checker" key={block._uid} ref={ref}>
      Should have a passed ref
    </div>
  );
});

RefChecker.displayName = "RefChecker";

export default RefChecker;
