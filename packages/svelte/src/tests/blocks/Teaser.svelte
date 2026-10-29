<script lang="ts">
  import type { StoryblokBlockProps } from '../../lib/types';

  const { block, ...rest }: StoryblokBlockProps<{}> & Record<string, unknown> = $props();
</script>

<div data-testid="teaser" data-name={rest.name as string | undefined}>{block?.headline}</div>
