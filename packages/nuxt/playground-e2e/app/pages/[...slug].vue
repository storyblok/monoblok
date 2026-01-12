<script setup>
const { slug } = useRoute().params;
const { story } = await useAsyncStoryblok(
  slug && slug.length > 0 ? slug.join('/') : 'home',
  {
    api: {
      version: 'draft',
      language: 'en',
      resolve_relations: ['popular-articles.articles'],
    },
    bridge: {},
  },
);
</script>

<template>
  <div>
    <StoryblokComponent v-if="story" :blok="story.content" />
  </div>
</template>
