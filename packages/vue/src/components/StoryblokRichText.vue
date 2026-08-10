<script lang="ts">
import { defineComponent } from "vue";
import type { PropType } from "vue";
import type { StoryblokRichTextInput } from "@storyblok/richtext";
import BlokRenderer from "./BlokRenderer.ts";
import {
  createRichTextRenderer,
  type StoryblokVueRichTextComponentMap,
  type StoryblokVueRichTextRenderContext,
} from "../rich-text-renderer";

export default defineComponent({
  name: "StoryblokRichText",
  props: {
    document: {
      type: Object as PropType<StoryblokRichTextInput>,
      required: false,
    },
    optimizeImage: {
      type: [Boolean, Object] as PropType<StoryblokVueRichTextRenderContext["optimizeImage"]>,
      required: false,
    },
    components: {
      type: Object as PropType<StoryblokVueRichTextComponentMap>,
      required: false,
    },
    data: {
      type: null as unknown as PropType<unknown>,
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
      data: props.data,
    });
    return () => render(props.document);
  },
});
</script>
