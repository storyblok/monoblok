<script lang="ts">
  import { storyblokEditable } from '@storyblok/svelte';
  import type { StoryblokBlockComponentProps } from '@storyblok/svelte';
  import { StoryblokBlock } from './storyblok';

  const { block }: StoryblokBlockComponentProps<{ columns: any[] }> = $props();
</script>

<div use:storyblokEditable={block} class="grid">
  {#each block.columns as item (item._uid)}
    <div>
      Component UID: {item._uid}
      <StoryblokBlock block={item} />
    </div>
  {/each}
</div>
