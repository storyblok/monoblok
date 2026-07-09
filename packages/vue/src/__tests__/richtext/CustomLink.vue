<script setup lang="ts">
import type { SbVueRichTextProps } from '../../index.ts';

defineOptions({ inheritAttrs: false });
const props = defineProps<SbVueRichTextProps['link']>();
</script>

<template>
  <a data-type="custom-link" :href="props?.attrs?.href ?? ''" :target="props?.attrs?.target ?? '_blank'" v-bind="props.attrs?.custom">
    <slot></slot>
  </a>
</template>
