/// <reference types="vite/client" />
/// <reference types="astro/client" />

/**
 * Internal type declarations used for building the Astro SDK.
 * Not published in the package — for local development only.
 */

declare namespace App {
  interface Locals {
    _storyblok_preview_data?: {
      story: unknown;
      serverData?: unknown;
    };
  }
}

/**
 * `.astro` files are compiled by Astro, not resolved by plain `tsc`. This
 * lets the handful of `.ts` modules that import a `.astro` component
 * directly (`index.ts`, `define-storyblok-blocks.ts`) type-check outside an
 * Astro-aware editor/build. The real typings for those components still come
 * from Astro's own tooling when consumers build their app.
 */
declare module "*.astro" {
  const Component: any;
  export default Component;
}
