<!--
Custom heading component that internally uses StoryblokRichText.
This tests the infinite loop prevention - without it, this would cause:
HeadingWithRichText -> StoryblokRichText -> HeadingWithRichText -> ...
-->
<script lang="ts">
  import type { SbSvelteRichTextProps } from '$lib/richtext-helpers';
  import StoryblokRichText from '$lib/StoryblokRichText.svelte';

  const props: SbSvelteRichTextProps<'heading'> = $props();
  const level = props.attrs?.level || 1;
</script>

<svelte:element this={`h${level}`} data-type="recursive-heading" data-level={props.attrs?.level}>
  {#if props.content}
    <StoryblokRichText document={props.content} {...props.context} />
  {/if}
</svelte:element>
