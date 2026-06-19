<script lang="ts">
import { defineComponent } from 'vue';
import type { PropType } from 'vue';
import type { SbRichTextImageOptions, SbRichTextInput } from '@storyblok/richtext';
import BlokRenderer from './BlokRenderer.ts';
import { createRichTextRenderer, type SbVueRichTextComponentMap } from '../rich-text-renderer';

export default defineComponent({
  name: 'StoryblokRichText',
  props: {
    document: {
      type: Object as PropType<SbRichTextInput>,
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
    const render = createRichTextRenderer({
      optimizeImage: props.optimizeImage,
      components: {
        blok: BlokRenderer,
        ...props.components,
      },
    });
    return () => render(props.document);
  },
});
</script>
