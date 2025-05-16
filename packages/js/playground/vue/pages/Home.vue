<!-- eslint-disable no-console -->
<script setup>
import {
  apiPlugin,
  storyblokEditable,
  storyblokInit,
  useStoryblokBridge,
} from '@storyblok/js';
import { computed, onMounted, ref } from 'vue';

const { storyblokApi } = storyblokInit({
  accessToken: 'OurklwV5XsDJTIE1NJaD2wtt',
  use: [apiPlugin],
});

const { data: homeData } = await storyblokApi.get('cdn/stories/js', {
  version: 'draft',
});
const { data: testData } = await storyblokApi.get(
  'cdn/stories/js/testing-bridge-instances',
  {
    version: 'draft',
  },
);
console.log(testData);

const storyHome = ref(null);
storyHome.value = homeData.story;

const storyTest = ref(null);
storyTest.value = testData.story;

const homeEditable = computed(() => storyblokEditable(storyHome.value.content));
const testEditable = computed(() => storyblokEditable(storyTest.value.content));

onMounted(() => {
  useStoryblokBridge(
    storyHome.value.id,
    evStory => (storyHome.value = evStory),
  );
});
</script>

<template>
  <div>
    <div
      v-if="storyHome"
      :data-blok-c="homeEditable['data-blok-c']"
      :data-blok-uid="homeEditable['data-blok-uid']"
    >
      <h1>Headline: {{ storyHome.content.headline }}</h1>
    </div>
    <div
      v-if="storyTest"
      :data-blok-c="testEditable['data-blok-c']"
      :data-blok-uid="testEditable['data-blok-uid']"
    >
      <h1>Headline: {{ storyTest.content.headline }}</h1>
    </div>
  </div>
</template>
