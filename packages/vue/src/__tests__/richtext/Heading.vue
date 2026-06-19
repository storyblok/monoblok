<script setup lang="ts">
import type { SbVueRichTextProps } from '../../index.ts';

const props = defineProps<SbVueRichTextProps['heading']>();
</script>

<template>
  <h2 data-type="custom-heading" :data-level="props?.attrs?.level">
    <slot>
    </slot>
  </h2>
</template>
