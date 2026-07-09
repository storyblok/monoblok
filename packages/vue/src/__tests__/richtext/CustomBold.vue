<script setup lang="ts">
import type { SbVueRichTextProps } from '../../index.ts';

defineOptions({ inheritAttrs: false });
defineProps<SbVueRichTextProps['bold']>();
</script>

<template>
  <b data-type="custom-bold">
    <slot></slot>
  </b>
</template>
