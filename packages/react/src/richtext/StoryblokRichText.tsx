import { createRichTextRenderer } from "./renderer";
import type { ReactNode } from "react";
import type { StoryblokReactRichTextComponentProps } from "./renderer";

/**
 * Renders a Storyblok richtext document as React elements.
 *
 * Pass the richtext field value from a story directly to `document`. Use the
 * `components` prop to override how specific node or mark types are rendered,
 * and `optimizeImage` to enable automatic image optimisation via the Storyblok
 * Image Service.
 *
 * @example
 * ```tsx
 * <StoryblokRichText
 *   document={story.content.richtext}
 *   optimizeImage={{ width: 800 }}
 *   components={{ heading: MyHeading }}
 * />
 * ```
 */
export function StoryblokRichText({
  document,
  optimizeImage,
  components,
  data,
}: StoryblokReactRichTextComponentProps): ReactNode {
  const render = createRichTextRenderer({
    optimizeImage,
    components,
    data,
  });
  const content = render(document);
  return content;
}
