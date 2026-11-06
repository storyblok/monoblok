<script lang="ts">
  import type { StoryblokBlockComponentProps } from '../../../lib/types';

  const { block }: StoryblokBlockComponentProps<{ text: string }> = $props();
</script>

<span data-testid="leaf">{block.text}</span>
