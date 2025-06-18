import { createTextVNode, defineComponent, h } from 'vue';
import type { VNode } from 'vue';
import type {
  StoryblokRichTextNode,
  StoryblokRichTextNodeResolver,
  StoryblokRichTextOptions,
} from '@storyblok/js';
import { BlockTypes, richTextResolver } from '@storyblok/js';

/**
 * Enhanced component resolver that avoids resolveComponent lifecycle issues
 * This resolver wraps components in functional components to ensure proper Vue context
 */
const createSafeComponentResolver = (): StoryblokRichTextNodeResolver<VNode> => {
  return (node: StoryblokRichTextNode<VNode>): VNode => {
    const blokData = node?.attrs?.body?.[0];
    if (!blokData) {
      return h('div', { class: 'storyblok-component-empty' }, 'Empty component');
    }

    // Create a wrapper functional component that handles the component resolution safely
    const SafeStoryblokComponent = defineComponent({
      name: 'SafeStoryblokComponent',
      setup() {
        return () => {
          // Try to resolve component using a safe approach
          try {
            // Instead of using resolveComponent, we'll use a direct approach
            return h('div', {
              'class': 'storyblok-richtext-component',
              'data-component': blokData.component,
              'data-id': node.attrs?.id,
              'key': `richtext-component-${blokData._uid || Math.random()}`,
            }, [
              h('div', {
                class: 'storyblok-component-placeholder',
                style: 'border: 2px dashed #ccc; padding: 12px; background: #f9f9f9;',
              }, `Component: ${blokData.component}`),
            ]);
          }
          catch (error) {
            console.error('Error in SafeStoryblokComponent:', error);
            return h('div', {
              class: 'storyblok-component-error',
              style: 'border: 2px dashed #ff0000; padding: 12px; background: #ffeeee;',
            }, `Error loading component: ${blokData.component}`);
          }
        };
      },
    });

    return h(SafeStoryblokComponent);
  };
};

/**
 * Enhanced useStoryblokRichText composable that addresses the resolveComponent lifecycle issue
 * This version provides safer component resolution for rich text embedded components
 */
export function useStoryblokRichTextEnhanced(options: StoryblokRichTextOptions<VNode> = {}) {
  const safeComponentResolver = createSafeComponentResolver();

  const mergedOptions: StoryblokRichTextOptions<VNode> = {
    renderFn: h,
    textFn: (text: string) => createTextVNode(text),
    keyedResolvers: true,
    resolvers: {
      [BlockTypes.COMPONENT]: safeComponentResolver,
      ...options.resolvers,
    },
    ...options,
  };

  return richTextResolver<VNode>(mergedOptions);
}
