<script setup lang="ts">
// const storyblokApi = useStoryblokApi();
// // Checking custom Flush method
// storyblokApi.flushCache();

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

console.log({story});

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode,
    statusMessage: error.value.statusMessage
  });
}

</script>

<template>
  <div>
    <StoryblokComponent v-if="story" :blok="story.content" />
  </div>
</template>
