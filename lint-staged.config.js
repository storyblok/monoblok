/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  // No glob: every staged file goes through. A glob restated what the commands
  // below already know, and let root scripts, `.agents/`, `.vue`, and markdown
  // slip past both the linter and the formatter.
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
