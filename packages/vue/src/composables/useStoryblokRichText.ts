import type { VNode } from 'vue';
import { createTextVNode, h } from 'vue';
import type {
  SbBlokData,
  StoryblokRichTextOptions,
} from '@storyblok/js';
import { ComponentBlok, richTextResolver } from '@storyblok/js';
import StoryblokComponent from '../components/StoryblokComponent.vue';

export function useStoryblokRichText(options: StoryblokRichTextOptions<VNode | VNode[]>) {
  const { tiptapExtensions, ...rest } = options;
  const mergedOptions: StoryblokRichTextOptions<VNode | VNode[]> = {
    renderFn: h,
    // @ts-expect-error - createTextVNode types has been recently changed.
    textFn: createTextVNode,
    keyedResolvers: true,
    ...rest,
    tiptapExtensions: {
      blok: ComponentBlok.configure({
        renderComponent: (blok: Record<string, unknown>, id?: string) =>
          h(StoryblokComponent, { blok: blok as SbBlokData, id }),
      }),
      ...tiptapExtensions,
    },
  };
  return richTextResolver<VNode | VNode[]>(mergedOptions);
}
