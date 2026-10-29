<script lang="ts">
  import type { StoryblokBlockProps } from '../../lib/types';

  const { block }: StoryblokBlockProps = $props();
</script>

<div data-testid="fallback">unknown: {block?.component}</div>
