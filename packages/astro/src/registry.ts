import type { StoryblokBlockComponent, StoryblokBlockData, StoryblokComponentMap } from "./types";

interface Registry {
  components: StoryblokComponentMap;
  fallback?: StoryblokBlockComponent;
}

/**
 * Module-level state shared by every block renderer. `defineStoryblokBlocks`
 * writes to it, the `Storyblok*` Astro components read from it at render time.
 */
const registry: Registry = {
  components: {},
};

export function setBlocks(blocks: Registry): void {
  registry.components = blocks.components;
  registry.fallback = blocks.fallback;
}

/**
 * Resolves the component that should render `block`, falling back to the
 * configured fallback and finally to `undefined` (render nothing).
 */
export function resolveBlockComponent(
  block: StoryblokBlockData,
): StoryblokBlockComponent | undefined {
  const name = block?.component;
  const component = name ? registry.components[name] : undefined;

  if (component) return component;
  if (registry.fallback) return registry.fallback;

  if (isDev()) {
    console.warn(
      `[storyblok] No component registered for block type "${name}". ` +
        `Register it in \`defineStoryblokBlocks({ components })\` or provide a \`fallback\`.`,
    );
  }

  return undefined;
}

/**
 * Dev-only warning gate.
 *
 * `import.meta.env.DEV` is not reliable here: this module ships as a
 * dependency, and Vite only substitutes it in code it processes. When the
 * guard is left in the output it evaluates to `undefined.DEV` and throws, so
 * we fall back to the runtime environment instead.
 */
function isDev(): boolean {
  return typeof process === "undefined" || process.env?.NODE_ENV !== "production";
}
