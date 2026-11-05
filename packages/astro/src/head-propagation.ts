import RawStoryblokRichText from "./components/StoryblokRichText.astro";
import RenderChildren from "./components/richtext/RenderChildren.astro";
import RenderLinkGroup from "./components/richtext/RenderLinkGroup.astro";
import RenderLinkInner from "./components/richtext/RenderLinkInner.astro";
import RenderNode from "./components/richtext/RenderNode.astro";
import RenderStaticChildren from "./components/richtext/RenderStaticChildren.astro";
import RenderTable from "./components/richtext/RenderTable.astro";
import RenderTextNodeWithMarks from "./components/richtext/RenderTextNodeWithMarks.astro";

/**
 * Head propagation: Astro renders a component's head content (e.g. the scoped
 * styles of an MDX `<Content />`) into `<head>` only if it reaches that
 * component before flushing `<head>`. It does so by initializing, ahead of
 * time, every component instance flagged as propagating (`self`/`in-tree`),
 * which in turn creates and flags their children. It flags a module from its
 * import graph, so a component only reachable through props (a block
 * resolved from the registry, a rich text `components.blok`) breaks the chain
 * at every hop whose own module doesn't import it.
 *
 * `defineStoryblokBlocks()` flags its own wrappers; these are the rich text
 * hops between its `StoryblokRichText` and an embedded block or a custom
 * node or mark component. `.astro` components can't declare it themselves.
 * `ElementTag` and `RenderStaticStructure` only pass content through
 * `<slot />`, which Astro evaluates eagerly, so they need no flag.
 *
 * The flag is set on the shared components, so once any
 * `defineStoryblokBlocks()` has run, the plain `StoryblokRichText` export
 * propagates head content of custom components too.
 */
const RICH_TEXT_HOPS = [
  RawStoryblokRichText,
  RenderChildren,
  RenderLinkGroup,
  RenderLinkInner,
  RenderNode,
  RenderStaticChildren,
  RenderTable,
  RenderTextNodeWithMarks,
];

/**
 * Flags the rich text hops `in-tree`. A function rather than a module-level
 * statement: this module isn't in `sideEffects`, so bundlers (this package's
 * and the consumer's) may drop top-level statements that export nothing.
 */
export function propagateThroughRichText(): void {
  for (const component of RICH_TEXT_HOPS) {
    Object.assign(component, { propagation: "in-tree" });
  }
}

export { RawStoryblokRichText };
