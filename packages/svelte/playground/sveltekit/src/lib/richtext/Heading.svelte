<script lang="ts">
  import type { SbRichTextProps } from '@storyblok/svelte';
  import type { Snippet } from 'svelte';
  type Props = SbRichTextProps<'heading'> & {
    children?: Snippet;
  };
  const props: Props = $props();
</script>

<p>
  {@render props.children?.()}
</p>
