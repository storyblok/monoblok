<script setup lang="ts">
import type { SbBlokData } from "@storyblok/vue";

defineProps<{ blok: SbBlokData }>();
</script>

<template>
  <section data-test="featured-posts">FeaturedPosts works</section>
</template>
