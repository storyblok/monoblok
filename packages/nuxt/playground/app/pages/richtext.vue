<script setup lang="ts">
import { NuxtLink } from '#components';
import type { SbVueRichTextComponentMap } from '#imports';

const { story } = await useAsyncStoryblok('vue/test-richtext', {
  api: {
    version: 'draft',
  },
  bridge: {},
});

const components: SbVueRichTextComponentMap = {
  link: ({ attrs }, { slots }) => {
    if (attrs?.linktype === 'story') {
      return h(NuxtLink, {
        to: attrs.href ?? '#',
      }, {
        default: () => slots.default?.(),
      });
    }

    return h('a', {
      href: attrs?.href,
      target: attrs?.target,
      rel: attrs?.target === '_blank' ? 'noopener noreferrer' : undefined,
    }, slots.default?.());
  },
};
</script>

<template>
  <StoryblokRichText :document="story.content.richText" :components="components" />
</template>
