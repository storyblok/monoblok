<script setup lang="ts">
const route = useRoute();

const { story, error } = await useAsyncStoryblok(route.path, {
  api: {
    version: 'draft',
    language: 'en',
    resolve_relations: ['popular-articles.articles'],
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
    <StoryblokComponent v-if="story" :blok="story.content" />
  </div>
</template>
