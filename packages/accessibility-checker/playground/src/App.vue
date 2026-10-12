<script setup lang="ts">
import {
  apiPlugin,
  storyblokEditable,
  storyblokInit,
  useStoryblokBridge,
  type ISbStoryData,
} from "@storyblok/js";
import { onMounted, ref } from "vue";

const { storyblokApi } = storyblokInit({
  accessToken: import.meta.env.VITE_STORYBLOK_TOKEN,
  use: [apiPlugin],
});

const story = ref<ISbStoryData | null>(null);
const error = ref("");

onMounted(async () => {
  const slug = window.location.pathname.replace(/^\/|\/$/g, "") || "home";
  try {
    const { data } = await storyblokApi!.get(`cdn/stories/${slug}`, { version: "draft" });
    story.value = data.story;
    useStoryblokBridge(data.story.id, (updated) => (story.value = updated));
  } catch (cause) {
    error.value = `Could not load the story "${slug}". Check VITE_STORYBLOK_TOKEN. ${String(cause)}`;
  }
});
</script>

<template>
  <main>
    <p v-if="error">{{ error }}</p>
    <template v-if="story">
      <h1>{{ story.name }}</h1>
      <!-- Each block has an empty button, so its findings show the block's uid and component name. -->
      <section
        v-for="blok in story.content.body ?? []"
        :key="blok._uid"
        v-bind="storyblokEditable(blok)"
      >
        <h2>Block: {{ blok.component }}</h2>
        <button></button>
      </section>
    </template>

    <section>
      <h2>Image without alt text</h2>
      <img src="https://a.storyblok.com/f/1/missing-alt.jpg" width="64" height="64" />
    </section>

    <section>
      <h2>Empty button</h2>
      <button></button>
    </section>

    <section>
      <h2>Input without an associated label</h2>
      <input type="text" />
    </section>

    <section>
      <h2>Low-contrast text</h2>
      <p class="low-contrast">This text is light gray on a white background.</p>
    </section>
  </main>
</template>

<style>
.low-contrast {
  color: #cccccc;
}
</style>
