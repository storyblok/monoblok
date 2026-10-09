<script setup lang="ts">
import { apiPlugin, storyblokInit, useStoryblokBridge, type ISbStoryData } from "@storyblok/js";
import { onMounted, ref } from "vue";

const { storyblokApi } = storyblokInit({
  accessToken: import.meta.env.VITE_STORYBLOK_TOKEN,
  use: [
    apiPlugin,
    // createAccessibilityCheckerPlugin({
    //   allowedOrigins: [/^https?:\/\/localhost(:\d+)?$/],
    //   ruleTags: ["wcag2a", "wcag2aa"]
    // })
  ],
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
      <input type="text" placeholder="Email address" />
    </section>

    <section>
      <h2>Low-contrast text</h2>
      <p class="low-contrast">This text is light gray on a white background.</p>
    </section>
  </main>
</template>
