<script setup lang="ts">
const { story, error } = await useAsyncStoryblok('vue', {
  api: {
    version: 'draft',
    language: 'en',
    resolve_relations: 'popular-articles.articles',
  },
  bridge: {
    resolveRelations: 'popular-articles.articles',
  },
});

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode,
    statusMessage: error.value.statusMessage,
  });
}
</script>

<template>
  <div>
    <StoryblokComponent v-if="story && !error" :blok="story.content" />
    <div v-else-if="error">Error: {{ error.message }}</div>
  </div>
</template>
