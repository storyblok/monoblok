import { useMemo } from "react";
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
  // Memoize the renderer so it is not recreated on every render when options
  // are stable references (e.g. module-level component maps).
  const render = useMemo(
    () => createRichTextRenderer({ optimizeImage, components, data }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optimizeImage, components, data],
  );
  return render(document);
}
