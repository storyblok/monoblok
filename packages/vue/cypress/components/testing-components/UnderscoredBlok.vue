<script setup lang="ts">
const props = withDefaults(defineProps<{ name?: string }>(), { name: "featured_posts" });
const blok = { _uid: "1", component: props.name };
</script>

<template>
  <div data-test="root">
    <StoryblokComponent :blok="blok" />
  </div>
</template>
