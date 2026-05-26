import { defineComponent, h } from 'vue';
import StoryblokComponent from './StoryblokComponent.vue';
import type { SbBlokData } from '../types.ts';
import type { PropType } from 'vue';

const BlokRenderer = defineComponent({
  name: 'StoryblokBlokRenderer',

  props: {
    attrs: {
      type: Object as PropType<SbBlokData>,
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
