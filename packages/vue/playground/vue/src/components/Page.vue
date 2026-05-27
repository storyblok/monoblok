<script setup lang="ts">
import type { SbBlokData } from '@storyblok/vue';

defineProps<{ blok: SbBlokData & { body?: SbBlokData[] } }>();
</script>

<template>
  <div v-editable="blok" class="px-6" data-test="page">
    <StoryblokComponent
      v-for="inblok in blok.body"
      :key="inblok._uid"
      :blok="inblok"
    />
    <slot name="footer"></slot>
  </div>
</template>
