<script lang="ts">
  import type { SbRichTextProps } from '@storyblok/svelte';
  import type { Snippet } from 'svelte';

  type Props = SbRichTextProps<'bold'> & {
    children?: Snippet;
  };
  const props: Props = $props();
</script>

<b data-type="custom-bold">
  {@render props.children?.()}
</b>
