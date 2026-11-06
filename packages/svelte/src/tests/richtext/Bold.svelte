<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '$lib/richtext-helpers';

  const props: StoryblokSvelteRichTextProps<'bold'> = $props();
</script>

<b data-type="custom-bold">
  {@render props.children?.()}
</b>
