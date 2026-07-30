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

/**
 * Builds the import specifier naming a declaration file written from `baseName`.
 *
 * `toDeclarationFileName` writes `<baseName>.d.ts`, but an importer must name the
 * emitted module rather than the declaration, so the specifier is
 * `<baseName>.js`. An extension-less
 * specifier is TS2834 under `moduleResolution: node16`/`node18`/`nodenext` in an
 * ESM package — every modern Node-ESM setup — and this is generated code the user
 * is told not to edit, so they have no way to repair it. `.js` resolves under
 * every mode, including `bundler` and legacy `node10`, so it is strictly wider
 * than the extension-less form.
 *
 * Kept beside `toDeclarationFileName` so the written name and the specifier that
 * has to match it cannot drift apart.
 */
export function toDeclarationImportSpecifier(baseName: string): string {
  return `${baseName.replace(/\.d\.ts$/, '')}.js`;
}
