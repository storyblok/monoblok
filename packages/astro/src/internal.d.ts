/// <reference types="vite/client" />
/// <reference types="astro/client" />

/**
 * Internal type declarations used for building the Astro SDK.
 * Not published in the package — for local development only.
 */

declare namespace App {
  interface Locals {
    _storyblok_preview_data?: {
      // Inline `import type` keeps this file a global script; a top-level import
      // would turn it into a module and break the `declare module` blocks below.
      story: import("@storyblok/js").ISbStoryData;
      serverData?: unknown;
    };
  }
}

/** Registered Storyblok components mapped by name. */
declare module "virtual:import-storyblok-components" {
  import type { AstroComponentFactory } from "astro/runtime/server/index.js";

  export const storyblokComponents: Record<string, () => Promise<AstroComponentFactory>>;
}

/** Integration options provided to the Astro SDK. */
declare module "virtual:storyblok-options" {
  import type { IntegrationOptions } from "./lib/storyblok-integration";

  const options: IntegrationOptions;
  export default options;
}

// Dev stub. Real types come from the built package.
declare module "@storyblok/astro" {
  /** Converts a string to camelCase (internal helper). */
  export function toCamelCase(input: string): string;
  export function sanitizeJSON(data: unknown): string;
  export function isEditorRequest(url: URL, options?: StoryblokValidationOptions): boolean;

  export type { SbBlokData } from "@storyblok/js";
  // add more exports as needed
}
