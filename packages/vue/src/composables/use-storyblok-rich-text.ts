import type { MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';
import type { SbRichTextNode } from '@storyblok/richtext';
import BlokRenderer from '../components/BlokRenderer';
import { createRichTextRenderer, type SbVueRichTextRenderContext } from '../rich-text-renderer';

export interface StoryblokRichTextProps extends SbVueRichTextRenderContext {
  document: MaybeRefOrGetter<
    SbRichTextNode | SbRichTextNode[] | null | undefined
  >;
}

/**
 * Vue composable for rendering Storyblok Rich Text.
 *
 * Binds rendering configuration (image optimization, custom components)
 * and returns a computed VNode tree based on the provided document.
 *
 * The returned VNode automatically updates when the document or options change.
 *
 * @example
 * ```ts
 * const richText = useStoryblokRichText({
 *   document: story.content.richtext,
 *   optimizeImage: true,
 *   components: {
 *     heading: CustomHeading,
 *   },
 * });
 * ```
 *
 * @example
 * ```vue
 * <template>
 *   <component :is="richText" />
 * </template>
 * ```
 */
export function useStoryblokRichText(
  props: StoryblokRichTextProps,
) {
  const render = createRichTextRenderer({
    optimizeImage: props.optimizeImage,
    components: {
      blok: BlokRenderer,
      ...props.components,
    },
  });

  return computed(() => render(toValue(props.document)));
}
