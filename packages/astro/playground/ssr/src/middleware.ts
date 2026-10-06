import { sequence } from "astro:middleware";
import { liveEditMiddleware } from "@storyblok/astro";

export const onRequest = sequence(liveEditMiddleware);
