import { defineStoryblokBlocks } from "../define-storyblok-blocks";
import { Page } from "./page-eager";

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: { page: Page },
}));

// Misuse: calling StoryblokBlock as a plain function at module-evaluation
// time instead of letting React render it. This forces resolveRegistry() to
// run right now, mid-cycle — before page-eager.tsx's `Page` binding has
// initialized — so it fails the same way the old eager API always did
// (see eager-call.test.tsx for which error each module loader throws).
StoryblokBlock({ block: { _uid: "root", component: "page" } } as any);
