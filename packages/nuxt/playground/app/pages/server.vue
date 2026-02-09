<script setup lang="ts">
const { data, pending, error } = await useFetch('/api/test');

onMounted(() => {
  if (data.value?.story) {
    useStoryblokBridge(data.value.story.id, (newStory: any) => {
      // Replace entire object for compatibility with both Nuxt 3 ref and Nuxt 4 shallowRef
      data.value = {
        ...data.value,
        story: newStory,
      };
    });
  }
});
</script>

<template>
  <div>
    <div v-if="pending">Loading...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <div v-else>
      <StoryblokComponent v-if="data?.story" :blok="data.story.content" />
    </div>
  </div>
</template>
