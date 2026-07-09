<script lang="ts">
  import { normalizeNodes, type SbRichTextInput } from '@storyblok/richtext';
  import RenderChildren from './richtext/RenderChildren.svelte';
  import type { SbSvelteRichTextRenderContext } from './richtext-helpers';

  type Props = SbSvelteRichTextRenderContext & {
    document: SbRichTextInput;
  } & Record<string, unknown>;

  const { document, components = {}, optimizeImage, data }: Props = $props();
  const nodes = $derived.by(() => normalizeNodes(document, true));
</script>

<RenderChildren {nodes} options={{ components, optimizeImage, data }} />
