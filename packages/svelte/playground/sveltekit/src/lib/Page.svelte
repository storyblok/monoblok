<script lang="ts">
  import { storyblokEditable, StoryblokRichText } from '@storyblok/svelte';
  import type { StoryblokBlockComponentProps } from '@storyblok/svelte';
  import { StoryblokBlock } from './storyblok';
  import Heading from './richtext/Heading.svelte';
  import Bold from './richtext/Bold.svelte';

  const { block }: StoryblokBlockComponentProps<{ body: any[]; richText: any }> = $props();
</script>

<div use:storyblokEditable={block} class="px-6">
  {#each block.body as bodyBlock (bodyBlock._uid)}
    <StoryblokBlock block={bodyBlock} />
  {/each}
  <StoryblokRichText document={block.richText} components={{ heading: Heading, bold: Bold }} />
</div>
