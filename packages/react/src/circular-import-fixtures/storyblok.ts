import { defineStoryblokBlocks } from "../define-storyblok-blocks";
import { Page } from "./page";

// The registry module: imports a block component to register it, while that
// same component imports `StoryblokBlock` back from here to recurse into
// `body` — this file and ./page.tsx form an import cycle.
export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: { page: Page },
}));
