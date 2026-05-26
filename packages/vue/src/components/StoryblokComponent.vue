<script lang="ts">
import {
  defineComponent,
  h,
  inject,
  ref,
  resolveDynamicComponent,
  useAttrs,
  useSlots,
} from 'vue';
import type { Component, PropType } from 'vue';
import type { SbBlokData, SbVueSDKOptions } from '../types.ts';

export default defineComponent({
  name: 'StoryblokComponent',

  props: {
    blok: {
      type: Object as PropType<SbBlokData>,
      required: true,
    },
  },

  setup(props, { expose }) {
    const attrs = useAttrs();
    const slots = useSlots();

    const blokRef = ref();

    expose({
      value: blokRef,
    });
    const VueSDKOptions = inject<SbVueSDKOptions | undefined>(
      'VueSDKOptions',
    );

    const componentFound
      = typeof resolveDynamicComponent(props.blok.component) !== 'string';

    let componentName = props.blok.component?.replace(/_/g, '-');
    if (!componentFound) {
      if (!VueSDKOptions?.enableFallbackComponent) {
        console.error(
          `Component could not be found for blok "${props.blok.component}"! Is it defined in main.ts as "app.component("${props.blok.component}", ${props.blok.component});"?`,
        );
      }
      else {
        componentName
          = VueSDKOptions.customFallbackComponent
            ?? 'FallbackComponent';

        if (
          typeof resolveDynamicComponent(componentName) === 'string'
        ) {
          console.error(
            `Is the Fallback component "${componentName}" registered properly?`,
          );
        }
      }
    }
    const resolvedComponent = resolveDynamicComponent(
      componentName,
    ) as Component;
    return () =>
      h(
        resolvedComponent,
        {
          ref: blokRef,
          ...props,
          ...attrs,
        },
        slots,
      );
  },
});
</script>
