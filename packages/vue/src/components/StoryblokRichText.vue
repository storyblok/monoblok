<script setup lang="ts">
import { ref, type VNode, watch } from 'vue';
import type {
  StoryblokRichTextNode,
} from '@storyblok/js';
import { useStoryblokRichText } from '../composables/useStoryblokRichText';
import type { StoryblokRichTextProps } from '../types';

const props = defineProps<StoryblokRichTextProps>();

const renderedDoc = ref();
const root = () => renderedDoc.value;

watch([() => props.doc, () => props.tiptapExtensions], ([doc, tiptapExtensions]) => {
  const { render } = useStoryblokRichText({
    tiptapExtensions: tiptapExtensions as Record<string, any>,
  });
  renderedDoc.value = render(doc as StoryblokRichTextNode<VNode | VNode[]>);
}, {
  immediate: true,
  deep: true,
});
</script>

<template>
  <root />
</template>
