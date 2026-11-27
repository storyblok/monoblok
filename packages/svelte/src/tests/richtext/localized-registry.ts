import { defineStoryblokBlocks } from "../../lib/define-storyblok-blocks";
import RequiresLocale from "../blocks/RequiresLocale.svelte";

export const { StoryblokBlock } = defineStoryblokBlocks<{ locale: string }>(() => ({
  components: { localized: RequiresLocale },
}));
