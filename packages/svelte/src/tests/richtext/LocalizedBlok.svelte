<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '$lib/richtext-helpers';
  import { StoryblokBlock } from './localized-registry';

  // `locale` comes from `StoryblokRichText`'s `data`, typed without a cast.
  const { attrs, context }: StoryblokSvelteRichTextProps<'blok', { locale: string }> = $props();
  const blocks = $derived(Array.isArray(attrs?.body) ? attrs.body : []);
</script>

{#each blocks as block, index (block._uid ?? index)}
  <StoryblokBlock {block} locale={context.data.locale} />
{/each}
