<script lang="ts" generics="T extends SbBlokData">
  import { getComponent, type SbBlokData } from './index';
  import type { Component } from 'svelte';

  type Props = {
    blok: T;
  } & Record<string, unknown>;

  const props: Props = $props();

  const SvelteComponent = $derived(
    props.blok.component ? (getComponent(props.blok.component) as Component<Props>) : null,
  );
</script>

{#if SvelteComponent}
  <SvelteComponent {...props} />
{/if}
