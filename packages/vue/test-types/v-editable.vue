<script setup lang="ts">
// Regression fixture for https://github.com/storyblok/monoblok/issues/620:
// `v-editable` must be a recognized global directive under `strictTemplates`.
import type { SbBlokData } from '@storyblok/vue';

defineProps<{ blok: SbBlokData }>();
</script>

<template>
  <div v-editable="blok">
    {{ blok.component }}
  </div>
</template>
