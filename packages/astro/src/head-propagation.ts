import RawStoryblokRichText from "./components/StoryblokRichText.astro";
import RenderChildren from "./components/richtext/RenderChildren.astro";
import RenderLinkGroup from "./components/richtext/RenderLinkGroup.astro";
import RenderNode from "./components/richtext/RenderNode.astro";
import RenderStaticChildren from "./components/richtext/RenderStaticChildren.astro";
import RenderTable from "./components/richtext/RenderTable.astro";

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
 * hops between its `StoryblokRichText` and an embedded block, flagged here
 * since `.astro` components can't declare it themselves.
 */
const RICH_TEXT_HOPS = [
  RawStoryblokRichText,
  RenderChildren,
  RenderLinkGroup,
  RenderNode,
  RenderStaticChildren,
  RenderTable,
];

for (const component of RICH_TEXT_HOPS) {
  Reflect.set(component, "propagation", "in-tree");
}

export { RawStoryblokRichText };
