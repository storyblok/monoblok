<script lang="ts">
  import { StoryblokRichText } from '@storyblok/svelte';
  import type { StoryblokBlockComponentProps } from '@storyblok/svelte';
  import { StoryblokBlock } from '../../storyblok';
  import Heading from '../richtext/Heading.svelte';
  import Bold from '../richtext/Bold.svelte';
  import Blok from '../richtext/Blok.svelte';

  const { block, editable }: StoryblokBlockComponentProps<{ body: any[]; richText: any }> =
    $props();
</script>

<div {...editable} class="px-6">
  {#each block.body as bodyBlock (bodyBlock._uid)}
    <StoryblokBlock block={bodyBlock} />
  {/each}
  <StoryblokRichText
    document={block.richText}
    components={{ heading: Heading, bold: Bold, blok: Blok }}
  />
</div>
