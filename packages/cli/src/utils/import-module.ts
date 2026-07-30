/**
 * Imports a user-authored module with `jiti`, so TypeScript entry files work
 * without a build step.
 *
 * Deliberately thin: no error wrapping and no path resolution, because the
 * callers disagree on both. Pass an **absolute** path. jiti resolves a relative
 * specifier against this module's own location, which is not the user's project,
 * and nested imports inside the loaded module resolve relative to that module
 * regardless.
 *
 * Importing runs the module, so any top-level side effects it has will happen.
 */
export async function importModule(absolutePath: string): Promise<Record<string, unknown>> {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  return await jiti.import(absolutePath) as Record<string, unknown>;
}
