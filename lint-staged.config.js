/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  // No globs, and no file list passed on: both scripts run repo-wide because
  // they already know which files they own. Narrowing them here would duplicate
  // that knowledge and let through everything the glob forgot: root
  // scripts, `.agents/`, `.vue`, markdown. Nx caches the lint run, so it costs a couple
  // of seconds when nothing changed.
  //
  // `oxlint --fix` rewrites code but does not reformat it, so an autofix lands
  // unformatted (wrong indentation, dropped trailing commas) unless the
  // formatter runs afterwards. `--concurrent=false` in the hook keeps that order.
  "*": [() => "pnpm lint:fix", () => "pnpm format"],
};
