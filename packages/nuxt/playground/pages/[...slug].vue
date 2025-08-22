<script setup lang="ts">
const { slug } = useRoute().params;
const { story } = await useAsyncStoryblok(
  slug && slug.length > 0 ? (slug as string[]).join('/') : 'home',
  {
    api: {
      version: 'draft',
      language: 'en',
      resolve_relations: ['popular-articles.articles'],
    },
    bridge: {
      resolveRelations: 'popular-articles.articles',
    },
  },
);
</script>

<template>
  <div>
    <StoryblokComponent v-if="story" :blok="story.content" />
  </div>
</template>
