<!--
Custom heading component that internally uses StoryblokRichText.
This tests the infinite loop prevention - without it, this would cause:
HeadingWithRichText -> StoryblokRichText -> HeadingWithRichText -> ...
-->
<script setup lang="ts">
import type { SbVueRichTextProps } from '../../index.ts';
import StoryblokRichText from '../../components/StoryblokRichText.vue';

const props = defineProps<SbVueRichTextProps['heading']>();
const level = props.attrs?.level || 1;
</script>

<template>
  <component :is="`h${level}`" data-type="recursive-heading" :data-level="attrs?.level">
    <StoryblokRichText v-if="content" :document="content" v-bind="context" />
  </component>
</template>
