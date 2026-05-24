<script lang="ts">
  import { buildStoryblokImage, type SbRichTextNode } from '@storyblok/richtext';
  import type { SbSvelteRendererOptions } from '../richtext-helpers';
  import RenderElement from './RenderElement.svelte';

  type ImageNode = SbRichTextNode & { type: 'image' };
  type Props = {
    node: ImageNode;
    options: SbSvelteRendererOptions;
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

<RenderElement node={optimizedNode} />
