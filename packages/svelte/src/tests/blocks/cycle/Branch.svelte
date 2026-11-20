<script lang="ts">
  import type { StoryblokBlockComponentProps } from '../../../lib/types';
  import { StoryblokBlock } from './registry';

  const { block }: StoryblokBlockComponentProps<{ body: any[] }> = $props();
</script>

<div data-testid="branch">
  {#each block.body as child (child._uid)}
    <StoryblokBlock block={child} />
  {/each}
</div>
