import { apiPlugin, StoryblokVue } from "@storyblok/vue";
import { defineNuxtPlugin, useRuntimeConfig } from "#app";

export default defineNuxtPlugin(({ vueApp }) => {
  const { storyblok } = useRuntimeConfig().public;

  if (storyblok.enableServerClient) {
    vueApp.use(StoryblokVue, { ...storyblok });
  } else {
    vueApp.use(StoryblokVue, { ...storyblok, use: [apiPlugin] });
  }
});
