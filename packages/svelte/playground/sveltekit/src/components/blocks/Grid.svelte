<script lang="ts">
  import type { StoryblokBlockComponentProps } from '@storyblok/svelte';
  import { StoryblokBlock } from '../../storyblok';

  const { block, editable }: StoryblokBlockComponentProps<{ columns: any[] }> = $props();
</script>

<div {...editable} class="grid">
  {#each block.columns as item (item._uid)}
    <div>
      Component UID: {item._uid}
      <StoryblokBlock block={item} />
    </div>
  {/each}
</div>
