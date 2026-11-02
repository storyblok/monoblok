<script> 
  import { storyblokEditable } from "@storyblok/svelte"

  export let blok;
</script>

<div class="teaser" use:storyblokEditable={blok}>
  <h2>{blok.headline}</h2>
</div>
