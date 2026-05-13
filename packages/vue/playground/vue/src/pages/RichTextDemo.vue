<script setup lang="ts">
import {
  StoryblokRichText,
  useStoryblok,
} from '@storyblok/vue';

const story = await useStoryblok(
  'richtext',
  {
    version: 'draft',
  },
);

setTimeout(() => {
  story?.value?.content.richText.content.push({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'This is a new paragraph added after 5 seconds.',
      },
    ],
  });
}, 5000);
</script>

<template>
  <StoryblokRichText v-if="story?.content.richText" :doc="story?.content.richText" />
</template>
