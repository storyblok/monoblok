<script setup lang="ts">
import { inject, ref, resolveDynamicComponent, useSlots } from 'vue';
import type { Slots } from 'vue';
import type { SbBlokData, SbVueSDKOptions } from '../types.ts';

const props = defineProps<{ blok: SbBlokData }>();

const slots: Slots = useSlots();

const blokRef = ref();
defineExpose({
  value: blokRef,
});

const componentFound: boolean
  = typeof resolveDynamicComponent(props.blok.component) !== 'string';

const VueSDKOptions: SbVueSDKOptions | undefined = inject('VueSDKOptions');

const componentName = ref(props.blok.component?.replace(/_/g, '-'));
if (!componentFound && VueSDKOptions) {
  if (!VueSDKOptions.enableFallbackComponent) {
    console.error(
      `Component could not be found for blok "${props.blok.component}"! Is it defined in main.ts as "app.component("${props.blok.component}", ${props.blok.component});"?`,
    );
  }
  else {
    componentName.value
      = VueSDKOptions.customFallbackComponent ?? 'FallbackComponent';

    if (typeof resolveDynamicComponent(componentName.value) === 'string') {
      console.error(
        `Is the Fallback component "${componentName.value}" registered properly?`,
      );
    }
  }
}
</script>

<template>
  <component :is="componentName" ref="blokRef" v-bind="{ ...$props, ...$attrs }">
    <template v-for="name in Object.keys(slots)" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps"></slot>
    </template>
  </component>
</template>
