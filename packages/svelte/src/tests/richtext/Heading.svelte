<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '$lib/richtext-helpers';

  const props: StoryblokSvelteRichTextProps<'heading'> = $props();
  const tag = $derived(`h${props.attrs?.level ?? 1}`);
</script>

<svelte:element this={tag} data-type="custom-heading" data-level={props.attrs?.level}>
  {@render props.children?.()}
</svelte:element>
