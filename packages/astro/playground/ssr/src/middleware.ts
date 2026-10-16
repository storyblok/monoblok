import { sequence } from "astro:middleware";
import { storyblokPreviewMiddleware } from "@storyblok/astro";

export const onRequest = sequence(storyblokPreviewMiddleware);
