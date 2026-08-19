/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  // No glob: the commands below already decide which files they handle, so a
  // path or extension filter here can only take files away from them, and
  // whatever it leaves out (root scripts, `.agents/`, `.vue`, markdown) is
  // linted and formatted by nothing.
  "*": [
    // Covers what no project owns, and so nothing else lints: repo config, the
    // release scripts, the agent scripts.
    () => "pnpm exec oxlint --disable-nested-config --fix",
    // `affected`, not the whole repo: a lint error in a project you never
    // touched should not block your commit.
    (filenames) =>
      `pnpm exec nx affected -t=lint --exclude="@storyblok/playground-*" --files=${filenames.join(",")} -- --fix`,
    // Last, because `oxlint --fix` rewrites code without reformatting it.
    // Repo-wide, because the fixes above can touch unstaged files.
    () => "pnpm exec vp fmt",
  ],
};
