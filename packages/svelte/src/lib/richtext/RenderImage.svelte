<script lang="ts">
  import { buildStoryblokImage, type StoryblokRichTextNodeWithKey } from '@storyblok/richtext';
  import type { StoryblokSvelteRichTextRenderContext } from '../richtext-helpers';
  import ElementTag from './ElementTag.svelte';

  type ImageNode = StoryblokRichTextNodeWithKey & { type: 'image' };
  type Props = {
    node: ImageNode;
    options: StoryblokSvelteRichTextRenderContext;
  };

  const { node, options }: Props = $props();
  const optimizedNode: ImageNode = $derived(
    options.optimizeImage && node?.attrs?.src
      ? {
          ...node,
          attrs: {
            ...node.attrs,
            ...buildStoryblokImage(node.attrs.src as string, options.optimizeImage),
          },
          type: 'image',
        }
      : node,
  );
</script>

<ElementTag node={optimizedNode} />
