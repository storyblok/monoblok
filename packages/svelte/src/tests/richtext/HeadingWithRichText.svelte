<!--
Custom heading component that internally uses StoryblokRichText.
This tests the infinite loop prevention - without it, this would cause:
HeadingWithRichText -> StoryblokRichText -> HeadingWithRichText -> ...
-->
<script lang="ts">
  import type { SbSvelteRichTextProps } from '$lib/richtext-helpers';
  import StoryblokRichText from '$lib/StoryblokRichText.svelte';

  const { attrs, content, context }: SbSvelteRichTextProps<'heading'> = $props();
  const level = $derived(attrs?.level || 1);
</script>

<svelte:element this={`h${level}`} data-type="recursive-heading" data-level={attrs?.level}>
  {#if content}
    <StoryblokRichText document={content} {...context} />
  {/if}
</svelte:element>
