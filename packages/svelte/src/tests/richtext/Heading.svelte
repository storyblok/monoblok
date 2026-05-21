<script lang="ts">
  import type { SbRichTextProps } from '@storyblok/svelte';
  import type { Snippet } from 'svelte';

  type Props = SbRichTextProps<'heading'> & {
    children?: Snippet;
  };
  const props: Props = $props();
</script>

<p data-type="custom-heading" data-level={props.attrs?.level}>
  {@render props.children?.()}
</p>
