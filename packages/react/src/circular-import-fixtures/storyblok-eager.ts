import { defineStoryblokBlocks } from "../define-storyblok-blocks";
import { Page } from "./page-eager";

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: { page: Page },
}));

// Misuse: calling StoryblokBlock as a plain function at module-evaluation
// time instead of letting React render it. This forces resolveRegistry() to
// run right now, mid-cycle — before page-eager.tsx's `Page` binding has
// initialized — so the block can't render, as with the old eager API (see
// eager-call.test.tsx for how each module loader reports it).
StoryblokBlock({ block: { _uid: "root", component: "page" } } as any);
