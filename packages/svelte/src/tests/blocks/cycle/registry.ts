import { defineStoryblokBlocks } from "../../../lib/define-storyblok-blocks";
import Branch from "./Branch.svelte";
import Leaf from "./Leaf.svelte";

// `Branch` imports `StoryblokBlock` back from this module, forming the import
// cycle that the factory passed to `defineStoryblokBlocks` exists to handle.
export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: { branch: Branch, leaf: Leaf },
}));
