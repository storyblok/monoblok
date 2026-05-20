<script lang="ts">
  import { buildSvelteAttrs, isSelfClosing, type PMMark, processAttrs, resolveTag } from '../index';
  import RenderTag from './RenderTag.svelte';
  import type { Snippet } from 'svelte';

  type Props = {
    mark: PMMark;
    children?: Snippet;
  };

  const { mark, children }: Props = $props();

  const tag = $derived(resolveTag(mark));
  const selfClosing = $derived(tag && isSelfClosing(tag));

  const attrs = $derived(buildSvelteAttrs(processAttrs(mark.type, mark.attrs)));
</script>

<RenderTag {tag} {attrs} {selfClosing}>
  {@render children?.()}
</RenderTag>
