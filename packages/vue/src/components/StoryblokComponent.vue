<script setup lang="ts">
import {
  camelize,
  capitalize,
  computed,
  getCurrentInstance,
  inject,
  ref,
  useSlots,
  watch,
} from "vue";
import type { Component, Slots } from "vue";
import type { SbBlokData, SbVueSDKOptions } from "../types.ts";

const props = defineProps<{ blok: SbBlokData }>();

const slots: Slots = useSlots();

const blokRef = ref();
defineExpose({
  value: blokRef,
});

const VueSDKOptions: SbVueSDKOptions | undefined = inject("VueSDKOptions");

const instance = getCurrentInstance();
const components: Record<string, Component> = instance?.appContext.components ?? {};
const resolve = (name: string): Component | undefined =>
  components[name] ?? components[camelize(name)] ?? components[capitalize(camelize(name))];

const fallbackName = VueSDKOptions?.customFallbackComponent ?? "FallbackComponent";

const component = computed(() => {
  const blokName = props.blok.component;
  if (!blokName) {
    return undefined;
  }
  const found = [blokName, blokName.replace(/_/g, "-")]
    .map(resolve)
    .find((candidate) => candidate && candidate !== instance?.type);
  if (found || !VueSDKOptions?.enableFallbackComponent) {
    return found;
  }
  return resolve(fallbackName);
});

watch(
  () => props.blok.component,
  (blokName) => {
    if (component.value || !blokName || !VueSDKOptions) {
      return;
    }
    if (VueSDKOptions.enableFallbackComponent) {
      console.error(`Is the Fallback component "${fallbackName}" registered properly?`);
      return;
    }
    const pascalName = capitalize(camelize(blokName.replace(/_/g, "-")));
    const hint = /^[A-Z][A-Za-z0-9]*$/.test(pascalName)
      ? `Register it as "${pascalName}": app.component("${pascalName}", ${pascalName}) in Vue, or a storyblok/${pascalName}.vue file in Nuxt.`
      : `Register it as "${blokName}": app.component("${blokName}", YourComponent) in Vue.`;
    console.error(`Component could not be found for blok "${blokName}"! ${hint}`);
  },
  { immediate: true },
);
</script>

<template>
  <component :is="component" v-if="component" ref="blokRef" v-bind="{ ...$props, ...$attrs }">
    <template v-for="name in Object.keys(slots)" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps"></slot>
    </template>
  </component>
</template>
