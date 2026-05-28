<script lang="ts">
import { defineComponent, toRaw } from 'vue';
import type { PropType } from 'vue';
import {
  createRichTextHook,
  type SbVueRichTextComponentMap,
} from '../composables/useStoryblokRichText';
import type { SbRichTextImageOptions, SbRichTextNode } from '@storyblok/richtext';

export default defineComponent({
  name: 'StoryblokRichText',
  props: {
    document: {
      type: Object as PropType<SbRichTextNode | SbRichTextNode[] | null | undefined>,
      required: false,
    },
    optimizeImage: {
      type: [Boolean, Object] as PropType<boolean | SbRichTextImageOptions>,
      required: false,
    },
    components: {
      type: Object as PropType<SbVueRichTextComponentMap>,
      required: false,
    },
  },

  setup(props) {
    const useStoryblokRichText = createRichTextHook();
    const rendered = useStoryblokRichText({
      optimizeImage: props.optimizeImage,
      components: toRaw(props.components),
      document: props.document,
    });

    return () => rendered.value;
  },
});
</script>
