<script lang="ts">
  import type { StoryblokBlockComponentProps } from '../../lib/types';

  const { block, locale }: StoryblokBlockComponentProps<{ headline: string }, { locale: string }> =
    $props();
</script>

<div data-locale={locale}>{block.headline}</div>
