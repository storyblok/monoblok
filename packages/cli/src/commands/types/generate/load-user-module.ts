import { resolve } from "pathe";

/**
 * Imports a user-provided module file, such as compiler options or a custom
 * fields parser, and returns its default export. Node's dynamic `import()`
 * cannot load every file users pass here: `.ts` files throw
 * `Unknown file extension` before Node 22.18 and `.json` files require an
 * import attribute on every version. jiti evaluates the file instead, so
 * `.ts`, `.js`, `.mjs`, `.cjs`, and `.json` files all load consistently,
 * matching how `storyblok.config.ts` is loaded (see `src/lib/config/loader.ts`
 * and `loadSchemaModule` in `src/utils/schema/classify-exports.ts`).
 */
export async function loadUserModule<T = Record<string, unknown>>(path: string): Promise<T> {
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    // Reading the tsconfig throws when it extends something unresolvable, which
    // would block type generation in a project that does not even use aliases.
    // jiti's own JITI_TSCONFIG_PATHS default is overridden by this explicit
    // option, so honour it here to leave users a way out.
    tsconfigPaths: process.env.JITI_TSCONFIG_PATHS !== "false",
  });
  return await jiti.import<T>(resolve(path), { default: true });
}
