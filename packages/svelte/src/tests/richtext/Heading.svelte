<script lang="ts">
  import type { SbSvelteRichTextProps } from '$lib/richtext-helpers';

  const props: SbSvelteRichTextProps<'heading'> = $props();
  const tag = $derived(`h${props.attrs?.level ?? 1}`);
</script>

<svelte:element this={tag} data-type="custom-heading" data-level={props.attrs?.level}>
  {@render props.children?.()}
</svelte:element>
