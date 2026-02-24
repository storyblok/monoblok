<script setup lang="ts">
import { defineComponent, h } from 'vue';
import { Mark } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import {
  asTag,
  StoryblokRichText,
  useStoryblok,
} from '@storyblok/vue';
import { RouterLink } from 'vue-router';

const story = await useStoryblok(
  'richtext',
  {
    version: 'draft',
  },
);

// Custom link mark: RouterLink for story links, <a> for everything else
const CustomLink = Mark.create({
  name: 'link',
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, string> }) {
    if (HTMLAttributes.linktype === 'story') {
      return [asTag(RouterLink), { to: HTMLAttributes.href, class: 'router-link' }, 0];
    }
    return ['a', { href: HTMLAttributes.href, target: HTMLAttributes.target }, 0];
  },
});

// Custom heading with Vue component styling
const CustomHeadingComponent = defineComponent({
  name: 'CustomHeading',
  props: {
    level: { type: Number, default: 1 },
  },
  setup(props, { slots }) {
    return () =>
      h(`h${props.level}`, {
        style: 'color: #1b243f; border-left: 4px solid #00b3b0; padding-left: 12px;',
      }, slots.default?.());
  },
});

const CustomHeading = Heading.extend({
  renderHTML({ node }: { node: { attrs: { level: number } } }) {
    return [CustomHeadingComponent, { level: node.attrs.level }, 0];
  },
});

const tiptapExtensions = {
  link: CustomLink,
  heading: CustomHeading,
};

setTimeout(() => {
  story.value.content.richText.content.push({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'This is a new paragraph added after 5 seconds.',
      },
    ],
  });
}, 5000);
</script>

<template>
  <StoryblokRichText v-if="story.content.richText" :doc="story.content.richText"
    :tiptap-extensions="tiptapExtensions" />
</template>
