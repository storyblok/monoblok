import { defineComponent, h } from 'vue';
import type { PropType } from 'vue';

import StoryblokComponent from './StoryblokComponent.vue';
import type { SbRichTextMark, SbRichTextNode } from '@storyblok/richtext';
import type { SbVueRichTextProps, SbVueRichTextRenderContext } from '@/rich-text-renderer.ts';

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
      type: Array as PropType<SbRichTextNode[]>,
      required: false,
    },
    marks: {
      type: Array as PropType<SbRichTextMark[]>,
      required: false,
    },
    _key: {
      type: String,
      required: false,
    },
    context: {
      type: Object as PropType<SbVueRichTextRenderContext>,
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
