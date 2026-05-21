<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve */
  import type { SbRichTextProps } from '@storyblok/svelte';
  import type { Snippet } from 'svelte';

  type Props = SbRichTextProps<'link'> & {
    children?: Snippet;
  };
  const { attrs, children }: Props = $props();
  const href = $derived(attrs?.anchor ? `${attrs?.href}#${attrs.anchor}` : attrs?.href);
</script>

<a data-type="custom-link" {href} target={attrs?.target ?? '_self'}>
  {@render children?.()}
</a>
