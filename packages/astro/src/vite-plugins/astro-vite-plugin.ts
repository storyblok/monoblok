import type { ViteUserConfig } from "astro";

/**
 * A Vite plugin typed against the Vite that Astro depends on, not this
 * package's own `vite`. The two can resolve to different versions, and
 * comparing their plugin types structurally (through Rolldown and its AST
 * types) runs close to TypeScript's depth limit, failing with TS2321
 * depending on type-check order.
 */
export type AstroVitePlugin = Extract<
  NonNullable<ViteUserConfig["plugins"]>[number],
  { name: string }
>;
