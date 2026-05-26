<script lang="ts">
import { defineComponent } from 'vue';
import type { PropType } from 'vue';
import {
  createRichTextHook,
  type SbVueRichTextComponentMap,
} from '../composables/useStoryblokRichText';
import type { SbRichTextDoc, SbRichTextImageOptions } from '../index.ts';

export default defineComponent({
  name: 'StoryblokRichText',

  props: {
    document: {
      type: Object as PropType<SbRichTextDoc | SbRichTextDoc[] | null | undefined>,
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
    const useStoryblokRichText
      = createRichTextHook();

    const rendered
      = useStoryblokRichText(props);

    return () => rendered.value;
  },
});
</script>
