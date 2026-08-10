import type { ComponentType } from "react";
import type { StoryblokReactRichTextProps } from "./richtext";
import type { SbBlokData } from "@storyblok/js";

export function createDefaultBlok(StoryblokComponent: ComponentType<{ blok: SbBlokData }>) {
  return function DefaultBlok({ attrs }: StoryblokReactRichTextProps<"blok">) {
    if (!Array.isArray(attrs?.body)) {
      return null;
    }

    return attrs.body.map((blok, index) => (
      <StoryblokComponent blok={blok} key={blok._uid || index} />
    ));
  };
}
