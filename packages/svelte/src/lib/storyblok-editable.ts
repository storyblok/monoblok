import { DEV } from "esm-env";
import { storyblokEditable as baseStoryblokEditable } from "@storyblok/live-preview";

import type { StoryblokEditableProps } from "./types";

/**
 * Returns the attributes that make a block editable in the Visual Editor.
 * Spread them onto the block's root element.
 *
 * @example
 * ```svelte
 * <section {...storyblokEditable(block)}>{block.headline}</section>
 * ```
 */
export function storyblokEditable(block?: { _editable?: string }): StoryblokEditableProps {
  // Before v8 this was a Svelte action. `use:storyblokEditable={block}` now
  // passes the DOM node instead of the block and silently returns `{}`.
  if (DEV && typeof Element !== "undefined" && block instanceof Element) {
    console.warn(
      "[storyblok] `storyblokEditable` is no longer a Svelte action. Replace " +
        "`use:storyblokEditable={block}` with `{...editable}` (the prop passed by " +
        "`StoryblokBlock`) or `{...storyblokEditable(block)}`.",
    );
  }
  return baseStoryblokEditable(block);
}
