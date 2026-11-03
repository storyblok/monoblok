import { isValidAstroComponent } from "./richtext-helpers";
import type { AstroComponentFactory, DefineStoryblokBlocksOptions } from "./types";

/**
 * The registry `defineStoryblokBlocks()` binds `StoryblokBlock` (and the
 * embedded bloks of its `StoryblokRichText`) to.
 */
export type StoryblokBlockRegistry = {
  /**
   * The registered component for a block type, or the `fallback`. Warns (via
   * `warn`) when the registered component or the fallback isn't a valid Astro
   * component, or when nothing resolves.
   */
  resolve: (name: string) => AstroComponentFactory | undefined;
  /**
   * Logs `message` once per `key`, unless the registry was defined with
   * `warnings: false`.
   */
  warn: (key: string, message: string) => void;
  /** The same registry with every warning silenced. */
  withoutWarnings: () => StoryblokBlockRegistry;
};

/**
 * Namespaced so it can't collide with a user-declared extra prop (see
 * `defineStoryblokBlocks<TExtraProps>()`).
 */
export const REGISTRY_PROP = "__storyblokRegistry";

/**
 * Creates the registry for one `defineStoryblokBlocks()` call. `factory` is
 * only called on the first `resolve`/`warn`, and only once.
 */
export function createBlockRegistry(
  // `any` so the registry doesn't care which extra props the components take:
  // `defineStoryblokBlocks()` already checked them.
  factory: () => DefineStoryblokBlocksOptions<any>,
): StoryblokBlockRegistry {
  let resolved: DefineStoryblokBlocksOptions<any> | undefined;
  const options = () => (resolved ??= factory());
  // Warnings already printed, so a server rendering the same page on every
  // request doesn't repeat the same warning each time.
  const warned = new Set<string>();

  const warn: StoryblokBlockRegistry["warn"] = (key, message) => {
    if (options().warnings === false || warned.has(key)) return;
    warned.add(key);
    console.warn(message);
  };

  const silent: StoryblokBlockRegistry = {
    ...bindResolve(options, () => {}),
    withoutWarnings: () => silent,
  };
  return { ...bindResolve(options, warn), withoutWarnings: () => silent };
}

/** `resolve`, reporting through `warn`. */
function bindResolve(
  options: () => DefineStoryblokBlocksOptions<any>,
  warn: StoryblokBlockRegistry["warn"],
): Pick<StoryblokBlockRegistry, "resolve" | "warn"> {
  const resolve: StoryblokBlockRegistry["resolve"] = (name) => {
    const { components = {}, fallback } = options();
    // Own properties only, so a block type such as `constructor` doesn't
    // resolve to an `Object.prototype` member.
    const registered = Object.hasOwn(components, name) ? components[name] : undefined;

    if (registered) {
      if (isValidAstroComponent(registered)) return registered;
      warn(
        `invalid:${name}`,
        `[storyblok] The component registered for block type "${name}" isn't a valid Astro ` +
          "component. Wrap framework components (React, Vue, ...) in an `.astro` component " +
          "with the appropriate `client:*` directive instead of registering them directly.",
      );
    }

    if (fallback) {
      // Held to the same bar as a registered component: a `fallback` that
      // isn't a real Astro component factory would otherwise fail silently,
      // with no warning telling you why nothing rendered.
      if (isValidAstroComponent(fallback)) return fallback;
      warn(
        "invalid-fallback",
        "[storyblok] The `fallback` passed to `defineStoryblokBlocks` isn't a valid Astro " +
          "component. Wrap framework components (React, Vue, ...) in an `.astro` component " +
          "with the appropriate `client:*` directive instead of passing them directly.",
      );
      return undefined;
    }

    // Content editors can add block types the code doesn't know about, so
    // this warns by default: otherwise the content silently goes missing.
    warn(
      `missing:${name}`,
      `[storyblok] No component registered for block type "${name}". ` +
        "Register it in `defineStoryblokBlocks(() => ({ components }))` or provide a `fallback`.",
    );
    return undefined;
  };

  return { resolve, warn };
}
