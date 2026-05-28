<script lang="ts">
  import { normalizeNodes, type SbRichTextNode } from '@storyblok/richtext';
  import RenderChildren from './richtext/RenderChildren.svelte';
  import type { SbSvelteRichTextRenderContext } from './richtext-helpers';

  type Props = SbSvelteRichTextRenderContext & {
    document: SbRichTextNode | null | undefined | SbRichTextNode[];
  } & Record<string, unknown>;

  const { document, components = {}, optimizeImage }: Props = $props();
  const nodes = $derived.by(() => normalizeNodes(document, true));
</script>

<RenderChildren {nodes} options={{ components, optimizeImage }} />
