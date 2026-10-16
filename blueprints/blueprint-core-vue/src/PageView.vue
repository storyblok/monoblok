<script setup>
import { useStoryblok } from '@storyblok/vue';
import { useRoute } from 'vue-router'

const slug = useRoute().params.slug
const story = await useStoryblok(`${slug ? slug.join('/') : 'home'}`, {
  version: 'draft',
});
</script>

<template>
  <StoryblokComponent v-if="story" :blok="story.content" />
</template>