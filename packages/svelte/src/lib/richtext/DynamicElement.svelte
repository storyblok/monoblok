<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    tag: string;
    children?: Snippet;
    attrs?: Record<string, unknown>;
    selfClosing?: boolean;
  };

  const { tag: Tag, children, attrs, selfClosing = false }: Props = $props();
</script>

{#if selfClosing}
  <svelte:element this={Tag} {...attrs} />
{:else}
  <svelte:element this={Tag} {...attrs}>
    {@render children?.()}
  </svelte:element>
{/if}
