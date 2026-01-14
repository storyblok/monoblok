<script setup lang="ts">
const storyblokApi = useStoryblokApi();

const { data: articles } = await storyblokApi.get('cdn/stories/', {
  version: 'draft',
  starts_with: 'vue/articles',
  is_startpage: false,
});
</script>

<template>
  <div class="container mx-auto">
    <h1>Articles</h1>
    <p>Here are some articles</p>
    <div class="pt-24">
      <NuxtLink
        v-for="article in articles.stories"
        :key="article.uuid"
        :to="`/articles/${article.slug}`"
      >
        <h2>{{ article.name }}</h2>
      </NuxtLink>
    </div>
  </div>
</template>
