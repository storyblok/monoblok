import { createTextVNode, h } from 'vue';
import type { VNode } from 'vue';
import type {
  StoryblokRichTextNode,
  StoryblokRichTextNodeResolver,
  StoryblokRichTextOptions,
} from '@storyblok/js';
import { BlockTypes, richTextResolver } from '@storyblok/js';
import StoryblokComponent from '../components/StoryblokComponent.vue';

/**
 * Component resolver that safely handles embedded components in rich text
 * Addresses Vue lifecycle issues during live preview editing (issue #11)
 */
const componentResolver: StoryblokRichTextNodeResolver<VNode> = (
  node: StoryblokRichTextNode<VNode>,
): VNode => {
  const blokData = node?.attrs?.body?.[0];
  if (!blokData) {
    return h('div', { class: 'storyblok-component-empty' }, 'Empty component');
  }

  // Use StoryblokComponent with proper keying to prevent lifecycle issues
  try {
    return h(
      StoryblokComponent,
      {
        blok: blokData,
        id: node.attrs?.id,
        key: `richtext-component-${blokData._uid || Math.random()}`,
      },
      node.children,
    );
  }
  catch (error) {
    console.error('Error rendering StoryblokComponent in rich text:', error);
    return h('div', {
      class: 'storyblok-component-error',
      style: 'border: 2px dashed #ff0000; padding: 12px; background: #ffeeee;',
    }, `Error loading component: ${blokData.component}`);
  }
};

export function useStoryblokRichText(options: StoryblokRichTextOptions<VNode> = {}) {
  const mergedOptions: StoryblokRichTextOptions<VNode> = {
    renderFn: h,
    textFn: (text: string) => createTextVNode(text),
    keyedResolvers: true,
    resolvers: {
      [BlockTypes.COMPONENT]: componentResolver,
      ...options.resolvers,
    },
    ...options,
  };

  return richTextResolver<VNode>(mergedOptions);
}
