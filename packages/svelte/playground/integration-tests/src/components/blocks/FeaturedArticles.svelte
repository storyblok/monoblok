<script lang="ts">
  import type { StoryblokBlockComponentProps } from "@storyblok/svelte";

  type Article = {
    name: string;
    full_slug: string;
  };

  const { block, editable }: StoryblokBlockComponentProps<{ heading: string; posts: Article[] }> =
    $props();
</script>

<section {...editable}>
  <h2>{block.heading}</h2>
  {#each block.posts ?? [] as post}
    <p class="post-title">{post.name}</p>
  {/each}
</section>
