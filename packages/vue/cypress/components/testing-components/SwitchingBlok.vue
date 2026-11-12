<script setup lang="ts">
import { ref } from "vue";

const blok = ref({ _uid: "1", component: "featured_posts" });
</script>

<template>
  <div data-test="root">
    <button data-test="switch" @click="blok = { _uid: '2', component: 'teaser' }">Switch</button>
    <StoryblokComponent :blok="blok" />
  </div>
</template>
