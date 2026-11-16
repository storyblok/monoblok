import { createComponent, createHeadAndContent, render } from "astro/runtime/server/index.js";

/**
 * Stands in for a rendered content collection entry (`<Content />`), which
 * returns its scoped styles as head content and flags itself `self`.
 */
export const HeadContent = createComponent({
  factory: () =>
    createHeadAndContent(
      '<style data-test="propagated-style"></style>',
      render`<p data-test="propagated-content">Content</p>`,
    ),
  propagation: "self",
});
