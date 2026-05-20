<script>
  import { storyblokEditable, StoryblokComponent, StoryblokRichText } from '@storyblok/svelte';
  import Heading from './richtext/Heading.svelte';
  import Bold from './richtext/Bold.svelte';

  let props = $props();
</script>

<div use:storyblokEditable={props.blok} class="px-6">
  {#each props.blok.body as bodyBlok (bodyBlok._uid)}
    <StoryblokComponent blok={bodyBlok} />
  {/each}
  <StoryblokRichText document={props.blok.richText} components={{ heading: Heading, bold: Bold }} />
</div>
