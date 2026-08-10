<script lang="ts">
  import { normalizeNodes, type StoryblokRichTextInput } from '@storyblok/richtext';
  import RenderChildren from './richtext/RenderChildren.svelte';
  import type { StoryblokSvelteRichTextRenderContext } from './richtext-helpers';

  type Props = StoryblokSvelteRichTextRenderContext & {
    document: StoryblokRichTextInput;
  } & Record<string, unknown>;

  const { document, components = {}, optimizeImage, data }: Props = $props();
  const nodes = $derived.by(() => normalizeNodes(document, true));
</script>

<RenderChildren {nodes} options={{ components, optimizeImage, data }} />
