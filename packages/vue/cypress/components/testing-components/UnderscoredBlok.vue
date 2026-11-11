<script setup>
const blok = { _uid: "1", component: "featured_posts" };
</script>

<template>
  <div data-test="root">
    <StoryblokComponent :blok="blok" />
  </div>
</template>
