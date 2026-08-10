import BlokRenderer from "../components/BlokRenderer";
import {
  createRichTextRenderer,
  type StoryblokVueRichTextRenderContext,
} from "../rich-text-renderer";

/**
 * Creates a Storyblok Rich Text renderer.
 *
 * The returned render function can be used to transform Storyblok Rich Text
 * documents into Vue VNodes using the provided configuration.
 *
 * Useful for configuring image optimization and custom node resolvers once
 * and reusing the renderer across multiple rich text documents.
 *
 * @example
 * ```ts
 * const render = useStoryblokRichText({
 *   optimizeImage: true,
 *   components: {
 *     heading: CustomHeading,
 *   },
 * });
 *
 * const content = computed(() => render(story.content.richtext));
 * ```
 *
 * @example
 * ```vue
 * <script setup>
 * const render = useStoryblokRichText();
 * </script>
 *
 * <template>
 *   <component :is="render(blok.articleContent)" />
 * </template>
 * ```
 */
export function useStoryblokRichText(props: StoryblokVueRichTextRenderContext) {
  return createRichTextRenderer({
    optimizeImage: props.optimizeImage,
    components: {
      blok: BlokRenderer,
      ...props.components,
    },
  });
}
