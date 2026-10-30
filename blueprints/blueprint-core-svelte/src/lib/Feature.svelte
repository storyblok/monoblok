<script> 
  import { storyblokEditable } from "@storyblok/svelte"

  export let blok;
</script>

<div class="feature" use:storyblokEditable={blok}>
  <span>{blok.name}</span>
</div>
