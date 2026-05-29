<script setup lang="ts">
import type { SbVueRichTextProps } from '../../index.ts';
import { splitTableRows, StoryblokRichText } from '../../index.ts';

const props = defineProps<SbVueRichTextProps['table']>();
const { headerRows, bodyRows } = splitTableRows(props.content);
</script>

<template>
  <table class="custom-table">
    <thead>
      <StoryblokRichText :document="headerRows" :components="props.context?.components" />
    </thead>
    <tbody>
      <StoryblokRichText :document="bodyRows" :components="props.context?.components" />
    </tbody>
  </table>
</template>
