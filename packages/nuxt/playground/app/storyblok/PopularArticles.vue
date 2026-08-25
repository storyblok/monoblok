<script setup lang="ts">
defineProps({
  blok: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <div v-editable="blok" class="py-4" data-test="popular-articles">
    <h3 class="text-xl">Popular articles</h3>
    <ul>
      <!--
        A resolved relation is an array of story objects; an unresolved one is an
        array of raw UUID strings. Rendering the raw value when unresolved is
        deliberate: it makes the difference visible to a test instead of blank.
      -->
      <li
        v-for="article in blok.articles"
        :key="typeof article === 'string' ? article : article.uuid"
        data-test="popular-article"
      >
        {{ typeof article === "string" ? article : article.content?.title }}
      </li>
    </ul>
  </div>
</template>
