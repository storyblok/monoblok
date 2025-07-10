<script setup lang="ts">
/* import type { SbBlokData } from '@storyblok/vue'; */

// const storyblokApi = useStoryblokApi();
// // Checking custom Flush method
// storyblokApi.flushCache();

const { story } = await useAsyncStoryblok('vue', {
  api: {
    version: 'draft',
    language: 'en',
    resolve_relations: 'popular-articles.articles',
  },
  bridge: {
    resolveRelations: 'popular-articles.articles',
  },
});

</script>

<template>
  <div>
    <StoryblokComponent v-if="story" :blok="story.content" />
  </div>
</template>
