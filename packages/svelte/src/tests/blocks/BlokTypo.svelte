<script lang="ts">
  import type { StoryblokBlockData } from '../../lib/types';

  // Uses the pre-v8 `blok` prop name, so `StoryblokBlock` never fills it.
  const { blok }: { blok: StoryblokBlockData } = $props();
</script>

<div>{blok.component}</div>
