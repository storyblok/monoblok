<script setup lang="ts">
import { ref } from 'vue';
import type { SbBlokData } from '@storyblok/vue';

interface EmojiRandomizerBlok extends SbBlokData {
  label?: string;
}

interface Props {
  blok: EmojiRandomizerBlok;
}

defineProps<Props>();

// List of fun emojis to randomly choose from
const emojis = ['😊', '🎉', '🚀', '✨', '🌈', '🎨', '🎸', '🎮', '🍕', '🌺'];

// Reactive state to track current emoji
const currentEmoji = ref<string>(
  emojis[Math.floor(Math.random() * emojis.length)],
);

/**
 * Generates a new random emoji different from the current one
 */
const randomizeEmoji = (): void => {
  let newEmoji: string;
  do {
    newEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  } while (newEmoji === currentEmoji.value);

  currentEmoji.value = newEmoji;
};
</script>

<template>
  <div
    v-editable="blok"
    class="flex flex-col items-center gap-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg"
    data-test="emoji-randomizer"
  >
    <!-- Large emoji display -->
    <div class="text-6xl">
      {{ currentEmoji }}
    </div>

    <!-- Randomize button -->
    <button
      class="px-6 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-small transition-colors duration-200 dark:bg-blue-600 dark:hover:bg-blue-700 dark:active:bg-blue-800"
      @click="randomizeEmoji"
    >
      {{ blok.label || 'Randomize Emoji' }}
    </button>
  </div>
</template>
