/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  // No glob: every staged file goes through, whatever its path or extension. A
  // glob here would duplicate what the three commands already know about which
  // files they own, and whatever it forgot would be linted and formatted by
  // nothing. That is how root scripts, `.agents/`, `.vue`, and markdown used to
  // slip through.
  "*": [
    // Projects lint themselves, so this covers only what no project owns: repo
    // config, the release scripts, the agent scripts. Nx cannot reach those,
    // and it is the same command the root `lint` script runs.
    () => "pnpm exec oxlint --disable-nested-config --fix",
    // Still `affected`, not the whole repo: a lint error in a project you never
    // touched should not block your commit. Non-project files in the list are
    // harmless, and a change to a root file correctly affects everything.
    (filenames) =>
      `pnpm exec nx affected -t=lint --exclude="@storyblok/playground-*" --files=${filenames.join(",")} -- --fix`,
    // `oxlint --fix` rewrites code but does not reformat it, so an autofix lands
    // unformatted (wrong indentation, dropped trailing commas) unless the
    // formatter runs afterwards. `--concurrent=false` in the hook keeps that
    // order. Repo-wide, because the fixes above can touch unstaged files.
    () => "pnpm exec vp fmt",
  ],
};
