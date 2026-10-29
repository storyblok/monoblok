import { storyblokEditable as sbEdit } from "@storyblok/live-preview";
import type { StoryblokBlockData } from "./types";

/**
 * Svelte action to make a component editable in Storyblok
 */
export const storyblokEditable = (node: HTMLElement, value: StoryblokBlockData) => {
  const updateDom = (value: StoryblokBlockData) => {
    const options = sbEdit(value);
    if (!options["data-blok-c"]) {
      return;
    }

    node.setAttribute("data-blok-c", options["data-blok-c"]);
    node.setAttribute("data-blok-uid", options["data-blok-uid"]);
    node.classList.add("storyblok__outline");
  };

  updateDom(value);

  return {
    update: updateDom,
  };
};
