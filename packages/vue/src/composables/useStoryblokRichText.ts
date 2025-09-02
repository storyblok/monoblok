import type { VNode } from 'vue';
import { createTextVNode, h } from 'vue';
import type {
  StoryblokRichTextNode,
  StoryblokRichTextNodeResolver,
  StoryblokRichTextOptions,
} from '@storyblok/js';
import { BlockTypes, richTextResolver } from '@storyblok/js';
import StoryblokComponent from '../components/StoryblokComponent.vue';

const componentResolver: StoryblokRichTextNodeResolver<VNode> = (
  node: StoryblokRichTextNode<VNode>,
): VNode => {
  return node?.attrs?.body.map(blok =>
    h(StoryblokComponent, {
      blok,
      id: node?.attrs?.id,
    }, node.children),
  );
};

export function useStoryblokRichText(options: StoryblokRichTextOptions<VNode>) {
  const mergedOptions: StoryblokRichTextOptions<VNode> = {
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
  return richTextResolver<VNode>(mergedOptions);
}
