<script lang="ts">
  import type { Component } from 'svelte';
  import type { StoryblokBlockData, StoryblokBlockProps } from '../../lib/types';

  type Props = {
    block: StoryblokBlockData;
    StoryblokBlock: Component<StoryblokBlockProps>;
  };

  let { block = $bindable(), StoryblokBlock }: Props = $props();

  export function update(nextBlock: StoryblokBlockData): void {
    block = nextBlock;
  }
</script>

<StoryblokBlock {block} />
