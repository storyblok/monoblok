<script setup lang="ts">
import type { SbVueRichTextProps } from '../../index.ts';

const props = defineProps<SbVueRichTextProps['code_block']>();

const lang = props?.attrs?.class ?? '';
</script>

<template>
  <pre :class="`language-${lang}`"><code :data-lang="lang"><slot></slot></code></pre>
</template>
