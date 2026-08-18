<script setup lang="ts">
defineProps({
  blok: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <!--
    The catch-all route renders whatever component a story declares, and the
    Visual Editor always previews a story at its own `full_slug`. Without a
    component for the `article` content type, an article opened in the editor
    renders nothing at all, which is indistinguishable from a dead bridge.
  -->
  <article v-editable="blok" class="container mx-auto pt-24" data-test="article">
    <h2 class="text-3xl">{{ blok.title }}</h2>
  </article>
</template>
