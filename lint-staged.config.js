
/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  '{packages,tools}/**/*.{js,ts,jsx,tsx,astro,json}': [
    (filenames) => `pnpm exec nx affected -t=lint --exclude="@storyblok/playground-*" --files=${filenames.join(',')} -- --fix`,
  ]
};
