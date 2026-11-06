<script lang="ts">
  import type { StoryblokBlockComponentProps } from '../../lib/types';

  type Props = StoryblokBlockComponentProps<{ headline?: string }, {
    components?: string;
    fallback?: string;
    name?: string;
  }>;

  const { block, editable, ...rest }: Props = $props();
</script>

<div
  data-testid="teaser"
  data-name={rest.name}
  data-components={rest.components}
  data-fallback={rest.fallback}
  {...editable}
>{block?.headline}</div>
