<script lang="ts">
  import type { SbSvelteRichTextProps } from '$lib/richtext-helpers';
  /* eslint-disable svelte/no-navigation-without-resolve */

  const { attrs, children }: SbSvelteRichTextProps<'link'> = $props();
  const href = $derived(attrs?.anchor ? `${attrs?.href}#${attrs.anchor}` : attrs?.href);
</script>

<a data-type="custom-link" {href} target={attrs?.target ?? '_self'} {...attrs?.custom}>
  {@render children?.()}
</a>
