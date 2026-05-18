<script setup lang="ts">
import { StoryblokRichText, useStoryblok } from '@storyblok/vue';

const story = await useStoryblok('vue/test-richtext', { version: 'draft' });
</script>

<template>
  <h2>RichText</h2>
  <!-- <pre>{{ story.content.richText }}</pre> -->
  <StoryblokRichText v-if="story.content" :document="story.content.richText" />
</template>
