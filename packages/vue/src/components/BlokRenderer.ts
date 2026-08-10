import { defineComponent, h } from 'vue';
import type { PropType } from 'vue';

import StoryblokComponent from './StoryblokComponent.vue';
import type { SbBlokData } from '../types.ts';
import type { StoryblokRichTextMark, StoryblokRichTextNode } from '@storyblok/richtext';
import type { StoryblokVueRichTextProps, StoryblokVueRichTextRenderContext } from '@/rich-text-renderer.ts';

const BlokRenderer = defineComponent({
  name: 'StoryblokBlokRenderer',

  props: {
    type: {
      type: String as PropType<'blok'>,
      required: true,
    },
    attrs: {
      type: Object as PropType<StoryblokVueRichTextProps['blok']['attrs']>,
      required: true,
    },
    content: {
      type: Array as PropType<StoryblokRichTextNode[]>,
      required: false,
    },
    marks: {
      type: Array as PropType<StoryblokRichTextMark[]>,
      required: false,
    },
    _key: {
      type: String,
      required: false,
    },
    context: {
      type: Object as PropType<StoryblokVueRichTextRenderContext>,
      required: false,
    },
  },
  setup(props) {
    return () =>
      Array.isArray(props.attrs.body)
        ? props.attrs.body.map((blok, index) =>
            h(StoryblokComponent, {
              blok: blok as unknown as SbBlokData,
              key: (blok as SbBlokData)._uid || index,
            }),
          )
        : null;
  },
});

export default BlokRenderer;
