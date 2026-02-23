<script setup lang="ts">
import { NuxtLink } from '#components';
import { Mark } from '@tiptap/core';
import { asTag } from '@storyblok/vue';

const { story } = await useAsyncStoryblok('vue/test-richtext', {
  api: {
    version: 'draft',
  },
  bridge: {},
});

const CustomLink = Mark.create({
  name: 'link',
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, string> }) {
    if (HTMLAttributes.linktype === 'story') {
      return [asTag(NuxtLink), { to: HTMLAttributes.href }, 0];
    }
    return ['a', { href: HTMLAttributes.href, target: HTMLAttributes.target }, 0];
  },
});

const tiptapExtensions = {
  link: CustomLink,
};
</script>

<template>
  <StoryblokRichText
    v-if="story?.content.richText"
    :doc="story.content.richText"
    :tiptap-extensions="tiptapExtensions"
  />
</template>
