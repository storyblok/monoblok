<script>
  import { StoryblokComponent, storyblokEditable } from "@storyblok/svelte";

  export let blok;
</script>

<div class="grid" use:storyblokEditable={blok}>
  {#each blok.columns as column}
    <StoryblokComponent blok={column} />
  {/each}
</div>
