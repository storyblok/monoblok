<script setup>
defineProps({ blok: Object });
</script>

<template>
  <div v-editable="blok" class="flex py-8 mb-6" data-test="grid">
    <div v-for="inblok in blok.columns" :key="inblok._uid" class="flex-auto px-6">
      <StoryblokComponent :blok="blok" />
    </div>
  </div>
</template>
