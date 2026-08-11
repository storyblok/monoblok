/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  "{packages,tools}/**/*.{js,ts,jsx,tsx,astro,json}": [
    (filenames) =>
      `pnpm exec nx affected -t=lint --exclude="@storyblok/playground-*" --files=${filenames.join(",")} -- --fix`,
    // `oxlint --fix` rewrites code but does not reformat it, so an autofix lands
    // unformatted (wrong indentation, dropped trailing commas) unless the
    // formatter runs afterwards. Repo-wide, because `nx affected` fixes whole
    // projects and can therefore touch files that are not staged.
    () => "pnpm exec vp fmt",
  ],
};
