<script setup lang="ts">
import type { SbVueRichTextProps } from '../../index.ts';

const props = defineProps<SbVueRichTextProps<'heading'>>();
</script>

<template>
  <p data-type="custom-heading" :data-level="props.attrs.level">
    <slot>
    </slot>
  </p>
</template>
