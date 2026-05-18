<script lang="ts">
import { defineComponent } from 'vue';
import type { PropType } from 'vue';
import {
  createRichTextHook,
  type SbVueRichTextComponents,
} from '../composables/useStoryblokRichText';

import StoryblokComponent from './StoryblokComponent.vue';
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
      type: Object as PropType<SbVueRichTextComponents>,
      required: false,
    },
  },

  setup(props) {
    const useStoryblokRichText
      = createRichTextHook(StoryblokComponent);

    const rendered
      = useStoryblokRichText(props);

    return () => rendered.value;
  },
});
</script>
