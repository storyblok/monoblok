/**
 * Builds the declaration file name from a `--filename` value.
 *
 * `--filename` is documented as taking a base name, and both generators append
 * `.d.ts` to it. Users reasonably read the documented default
 * (`storyblok-components.d.ts`) as the value to pass, which used to produce
 * `storyblok-components.d.ts.d.ts`. Tolerate an extension the user already
 * spelled out rather than doubling it.
 *
 * Shared by both generators so the same flag cannot mean two things depending on
 * `--future-schema`.
 */
export function toDeclarationFileName(filename: string): string {
  return `${filename.replace(/\.d\.ts$/, '')}.d.ts`;
}
