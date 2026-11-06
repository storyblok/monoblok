<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '$lib/richtext-helpers';

  const props: StoryblokSvelteRichTextProps<'code_block'> = $props();
</script>

<pre class={`language-${props.attrs?.class ?? ''}`}><code data-lang={props.attrs?.class}>{@render props.children?.()}</code></pre>
