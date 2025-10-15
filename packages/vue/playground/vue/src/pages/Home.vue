<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useStoryblokApi, useStoryblokBridge } from '@storyblok/vue';

const version = import.meta.env.MODE === 'production' ? 'published' : 'draft';

const storyblokApi = useStoryblokApi();
const { data } = await storyblokApi.get('cdn/stories/vue', {
  version,
});

const story = ref(null);
story.value = data.story;
// eslint-disable-next-line no-console
console.log(story.value);

onMounted(() => {
  if (!story.value) {
    return;
  }
  useStoryblokBridge(story.value.id, evStory => (story.value = evStory));
});
</script>

<template>
  <div class="prose mx-auto">
    <StoryblokComponent v-if="story" :blok="story.content">
      <template #footer>
        <div class="text-center">&copy; Storyblok</div>
      </template>
    </StoryblokComponent>
  </div>
</template>
