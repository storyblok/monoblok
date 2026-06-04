<script lang="ts">
  import { buildStoryblokImage, type SbRichTextNode } from '@storyblok/richtext';
  import type { SbSvelteRichTextRenderContext } from '../richtext-helpers';
  import ElementTag from './ElementTag.svelte';

  type ImageNode = SbRichTextNode & { type: 'image' };
  type Props = {
    node: ImageNode;
    options: SbSvelteRichTextRenderContext;
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
