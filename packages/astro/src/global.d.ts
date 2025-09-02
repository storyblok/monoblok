/* eslint-disable */
import type { StoryblokClient } from '@storyblok/astro';

declare global {
  var storyblokApiInstance: StoryblokClient | undefined;
}
export {};
