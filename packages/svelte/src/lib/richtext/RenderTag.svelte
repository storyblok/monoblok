<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    tag?: string | null;
    attrs?: Record<string, unknown>;
    selfClosing: boolean | null;
    children?: Snippet;
  };

  const { tag, attrs = {}, selfClosing = false, children }: Props = $props();
</script>

{#if tag}
  {#if selfClosing}
    <svelte:element this={tag} {...attrs} />
  {:else}
    <svelte:element this={tag} {...attrs}>
      {@render children?.()}
    </svelte:element>
  {/if}
{:else}
  {@render children?.()}
{/if}
