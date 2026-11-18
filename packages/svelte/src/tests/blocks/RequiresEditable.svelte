<script lang="ts">
  import type { StoryblokBlockData, StoryblokEditableProps } from '../../lib/types';

  // What `let { block, editable } = $props();` infers in a JS component with `checkJs`.
  const { block, editable }: { block: StoryblokBlockData; editable: StoryblokEditableProps } =
    $props();
</script>

<div {...editable}>{block.component}</div>
