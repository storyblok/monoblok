<script setup lang="ts">
import type { SbVueRichTextProps } from '../../index.ts';

const props = defineProps<SbVueRichTextProps['text']>();
const data = props.context?.data as { prefix: string } | undefined;
const prefix = data?.prefix ?? '';
</script>

<template>
  {{ prefix }} {{ text.toUpperCase() }}
</template>
