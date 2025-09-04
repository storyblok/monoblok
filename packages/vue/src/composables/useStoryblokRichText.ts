import type { VNode } from 'vue';
import { createTextVNode, h } from 'vue';
import type {
  SbBlokData,
  StoryblokRichTextNode,
  StoryblokRichTextNodeResolver,
  StoryblokRichTextOptions,
} from '@storyblok/js';
import { BlockTypes, richTextResolver } from '@storyblok/js';
import StoryblokComponent from '../components/StoryblokComponent.vue';

const componentResolver: StoryblokRichTextNodeResolver<VNode | VNode[]> = (
  node: StoryblokRichTextNode<VNode | VNode[]>,
): VNode[] => {
  const body = node?.attrs?.body;

  if (!Array.isArray(body) || body.length === 0) {
    return [];
  }

  return body.map((blok: SbBlokData) =>
    h(StoryblokComponent, {
      blok,
      id: node?.attrs?.id,
    }, node.children),
  );
};

export function useStoryblokRichText(options: StoryblokRichTextOptions<VNode | VNode[]>) {
  const mergedOptions: StoryblokRichTextOptions<VNode | VNode[]> = {
    renderFn: h,
    // TODO: Check why this changed.
    // @ts-expect-error - createTextVNode types has been recently changed.
    textFn: createTextVNode,
    keyedResolvers: true,
    resolvers: {
      [BlockTypes.COMPONENT]: componentResolver,
      ...options.resolvers,
    },
  };
  return richTextResolver<VNode | VNode[]>(mergedOptions);
}
