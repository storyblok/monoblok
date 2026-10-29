<script lang="ts">
  import type { StoryblokBlockComponentProps } from '../../lib/types';

  const { block }: StoryblokBlockComponentProps = $props();
</script>

<div data-testid="fallback">unknown: {block?.component}</div>
