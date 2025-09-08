<script setup lang="ts">
import type { SbBlokData } from '@storyblok/vue';

interface CustomBlok extends SbBlokData {
  count?: number;
}

interface Props {
  blok: CustomBlok;
}

defineProps<Props>();
</script>

<template>
  <div
    v-editable="blok"
    class="flex flex-col items-center gap-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg"
    data-test="emoji-randomizer"
  >
    <!-- Large emoji display -->
    <div class="text-6xl">
      {{ blok.count }}
    </div>
  </div>
</template>
