<script module lang="ts">
  let warned = false;
</script>

<script lang="ts">
  // Rendered only in development (see `RenderNode.svelte`). Runs on the server
  // and in the browser, printing once per environment.
  if (!warned) {
    warned = true;
    console.warn('[storyblok] "blok" nodes require a custom renderer passed through `components.blok`.');
  }
</script>
