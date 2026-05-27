import { defineComponent, h } from 'vue';
import type { PropType } from 'vue';

import StoryblokComponent from './StoryblokComponent.vue';
import type { SbVueRichTextComponentMap, SbVueRichTextProps } from '../composables/useStoryblokRichText';

const BlokRenderer = defineComponent({
  name: 'StoryblokBlokRenderer',

  props: {
    type: {
      type: String as PropType<'blok'>,
      required: true,
    },
    attrs: {
      type: Object as PropType<SbVueRichTextProps['blok']['attrs']>,
      required: false,
    },

    content: {
      type: Array as PropType<SbVueRichTextProps['blok']['content']>,
      required: false,
    },
    marks: {
      type: Array as PropType<SbVueRichTextProps['blok']['marks']>,
      required: false,
    },
    _key: {
      type: String,
      required: false,
    },

    components: {
      type: Object as PropType<SbVueRichTextComponentMap>,
      required: false,
    },
  },

  setup(props) {
    return () =>
      Array.isArray(props.attrs?.body)
        ? props.attrs.body.map((blok, index) =>
            h(StoryblokComponent, {
              blok,
              key: blok._uid || index,
            }),
          )
        : null;
  },
});

export default BlokRenderer;
