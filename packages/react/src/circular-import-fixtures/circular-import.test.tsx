import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

// Regression test for the import-cycle hazard defineStoryblokBlocks()'s
// factory API is meant to close: ./storyblok.ts registers ./page.tsx's
// `Page`, and `Page` imports `StoryblokBlock` back from ./storyblok.ts to
// recurse into `body` — a real ESM cycle, not a simulated one.
//
// With the old eager API (reading `components` synchronously at
// defineStoryblokBlocks() call time), importing `page.tsx` before
// `storyblok.ts` — as a real app does when a layout imports its block
// component directly — threw:
//   [Storyblok] defineStoryblokBlocks: components["page"] is undefined.
// because `Page`'s `const` binding was still in the temporal dead zone when
// storyblok.ts's module body ran. The factory API defers reading
// `components` until the first render, by which point the cycle has
// finished initializing.
describe("circular import between the registry module and a registered block", () => {
  it("resolves the component regardless of which module is imported first", async () => {
    const { Page } = await import("./page");
    const { StoryblokBlock } = await import("./storyblok");

    const block = { _uid: "root", component: "page", body: [] };
    const { queryByTestId } = render(<StoryblokBlock block={block as any} />);

    expect(queryByTestId("page")).not.toBeNull();
    void Page;
  });
});
