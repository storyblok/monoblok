import { forwardRef } from "react";
import type { BlockContent } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

interface RefCheckerProps {
  blok: BlockContent;
}

const RefChecker = forwardRef<HTMLDivElement, RefCheckerProps>(({ blok }, ref) => {
  return (
    <div {...storyblokEditable(blok)} data-test="ref-checker" key={blok._uid} ref={ref}>
      Shoud have a passed ref
    </div>
  );
});

RefChecker.displayName = "RefChecker";

export default RefChecker;
