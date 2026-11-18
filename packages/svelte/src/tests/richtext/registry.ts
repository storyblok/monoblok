import { defineStoryblokBlocks } from "../../lib/define-storyblok-blocks";
import Teaser from "../blocks/Teaser.svelte";

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({ components: { teaser: Teaser } }));
