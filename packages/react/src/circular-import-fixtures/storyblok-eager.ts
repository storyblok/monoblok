import { defineStoryblokBlocks } from "../define-storyblok-blocks";
import { Page } from "./page-eager";

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: { page: Page },
}));

// Misuse: calling StoryblokBlock as a plain function at module-evaluation
// time instead of letting React render it. This forces resolveRegistry() to
// run right now, mid-cycle — before page-eager.tsx's `Page` binding has
// initialized — so it throws the same way the old eager API always did.
StoryblokBlock({ block: { _uid: "root", component: "page" } } as any);
