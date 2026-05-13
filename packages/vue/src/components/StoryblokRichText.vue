<script setup lang="ts">
import { computed, type VNode } from 'vue';
import type { SbRichTextDoc } from '@storyblok/richtext';
import { type StoryblokRichTextRendererOptions, useStoryblokRichText } from '../composables/useStoryblokRichText';

interface StoryblokRichTextProps extends Omit<StoryblokRichTextRendererOptions, 'StoryblokComponent'> {
  doc: SbRichTextDoc | SbRichTextDoc[] | null | undefined;
}

const props = defineProps<StoryblokRichTextProps>();

const render = useStoryblokRichText({
  optimizeImage: props.optimizeImage,
  components: props.components,
});

const renderedDoc = computed<VNode | VNode[] | null>(() => {
  return render(props.doc);
});

const root = () => renderedDoc.value;
</script>

<template>
  <root />
</template>
