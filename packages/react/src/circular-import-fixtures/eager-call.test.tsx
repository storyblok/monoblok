import { describe, expect, it } from "vitest";

// The lazy factory closes the hazard for the normal case: StoryblokBlock is
// rendered by React, which only happens after the whole synchronous module
// graph (including this cycle) has finished loading.
//
// It does NOT protect against calling StoryblokBlock as a plain function at
// module-evaluation time, bypassing React's render pipeline entirely — e.g.
// a module in the same cycle that eagerly does
//   const html = renderToStaticMarkup(<StoryblokBlock block={x} />)
// at its top level instead of inside a component. That forces the registry
// to resolve mid-cycle, which is the same timing the old eager API had, so
// the same "is undefined" error can still fire. This test proves that
// residual case is real, not just a leftover comment.
describe("calling StoryblokBlock synchronously during module evaluation (not via React render)", () => {
  it("still throws, because resolving the registry that early is mid-cycle regardless of the factory", async () => {
    // page-eager.tsx: imports StoryblokBlock from storyblok-eager.ts, which
    // (being entered mid-cycle, before Page is assigned) immediately invokes
    // StoryblokBlock as a plain function at its own module scope.
    await expect(import("./page-eager")).rejects.toThrow(
      '[Storyblok] defineStoryblokBlocks: components["page"] is undefined.',
    );
  });
});
