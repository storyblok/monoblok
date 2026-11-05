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
// it still fails. This test proves that residual case is real, not just a
// leftover comment.
//
// The error depends on how the cycle is loaded. Vitest's module transform
// (like most bundlers) rewrites the import into a property read, which
// yields `undefined`, so the registry throws its own "is undefined" error,
// asserted below. Native ESM throws a `ReferenceError` ("Cannot access
// 'Page' before initialization") from inside the factory instead.
describe("calling StoryblokBlock synchronously during module evaluation (not via React render)", () => {
  it("should still throw, because resolving the registry that early is mid-cycle regardless of the factory", async () => {
    // page-eager.tsx: imports StoryblokBlock from storyblok-eager.ts, which
    // (being entered mid-cycle, before Page is assigned) immediately invokes
    // StoryblokBlock as a plain function at its own module scope.
    await expect(import("./page-eager")).rejects.toThrow(
      '[storyblok] defineStoryblokBlocks: components["page"] is undefined.',
    );
  });
});
