<script setup lang="ts">
import type { SbVueRichTextProps } from '../../index.ts';
import { splitTableRows, StoryblokRichText } from '../../index.ts';
import { tableComponents } from '../../__tests__/StoryblokRichText.test.ts';

const props = defineProps<SbVueRichTextProps['table']>();
const { headerRows, bodyRows } = splitTableRows(props.content);
</script>

<template>
  <table class="custom-table">
    <thead><StoryblokRichText :document="headerRows" :components="tableComponents" /></thead>
    <tbody><StoryblokRichText :document="bodyRows" :components="tableComponents" /></tbody>
  </table>
</template>
