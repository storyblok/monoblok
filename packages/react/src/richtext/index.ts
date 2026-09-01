export {
  type StoryblokReactRichTextComponent,
  type StoryblokReactRichTextComponentMap,
  type StoryblokReactRichTextComponentProps,
  type StoryblokReactRichTextProps,
  type StoryblokReactRichTextRenderContext,
  createRichTextRenderer,
} from "./renderer";

import { createStoryblokRichText } from "./create-storyblok-richtext";
export { createStoryblokRichText };

// Standalone richtext component with no embedded block support.
// Consumers who need blok rendering should use the StoryblokRichText
// returned by defineStoryblokComponents instead.
export const StoryblokRichText = createStoryblokRichText();
