<script lang="ts">
  import { DEV } from 'esm-env';

  if (DEV) {
    $effect(() => {
      console.warn('[storyblok] "blok" nodes require a custom renderer passed through `components.blok`.');
    });
  }
</script>
