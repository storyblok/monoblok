# Monoblok CLI

Internal CLI tool for managing the Storyblok monorepo. `pnpm install` builds it via its
`postinstall` hook. Rebuild it with `pnpm --filter monoblok-cli build` after changing it.

## License check

```bash
pnpm monoblok license check @storyblok/js
```

## Bundle size

The `size` commands guard what each package costs the people who use it. On every PR, the
`Bundle size` workflow builds the PR and its base branch in parallel, measures both builds with the
PR's `size measure`, and compares them with `size compare`. Nothing is committed as a baseline: the
base branch is the baseline. The report is posted as a PR comment, updated on every push, and only
PRs with something to report (a changed export, a file past the threshold, or a package that could
not be measured) get one. PRs from forks get the report in the job summary only, since their token
can't comment.

Every package under `packages/` is measured, except the ones in `IGNORED_PACKAGES` in
`src/commands/size/size.ts`, which never reach a browser (the CLI, the lint config, the migration
helpers). A new package is measured without any setup. Only ES modules are measured. Each package
gets:

| Measurement | What it covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entries     | What a browser downloads for each export (`exports`, `main`, `module`, `browser`): the export bundled with its dependencies and theirs, minified and gzipped. A dependency that the package importing it declares as a peer is left out, since the app provides it, and so are chunks that load lazily: they still reach the browser, but later and only when their feature runs, so they would blur the up-front cost of an import. A package's own lazy chunks are covered by the per-file check; lazily loaded dependencies are not measured yet. A change in one package therefore shows up in every package that depends on it. |
| Files       | Every published ES module in `dist` on its own, gzipped, matched across builds by its path. Chunk file names must not carry a content hash, or they never match.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

`IGNORED_EXPORTS` skips exports that never reach a browser, such as the Nuxt module or the richtext
HTML and Markdown parsers, and `EXTRA_ENTRIES` adds browser entries that `exports` does not list,
such as the Nuxt runtime plugin. Svelte components are compiled with the package's own Svelte. Astro
components are not bundled, since Astro compiles them, but every `<script>` that Astro processes in
a published `.astro` file is measured as an entry of its own, named after the file
(`dist/components/StoryblokPreview.astro <script>`). Astro's compiler decides which scripts that is,
so `is:inline` scripts and the other ones Astro leaves as they are don't count. The scripts are
measured as Vite builds them for production: `import.meta.env.DEV` is `false`, and imports without
an extension resolve with Vite's default extensions.

An entry or a file fails the check when it grows by more than 5% and more than 100 B gzipped. Files
are not minified, so without the byte threshold a comment added to a small file would fail. A
package that is not built, or whose export cannot be bundled, always fails.

If the growth is intended, add the `bundle-size-accepted` label to the PR and re-run the failed
`compare` job. Growth is then reported as a warning.

```bash
# Measure the current build output (build first; entries resolve dependencies from node_modules)
pnpm nx run-many -t build --exclude=storyblok
pnpm monoblok size measure --out size-head.json

# Measure another installed and built checkout, e.g. of main
pnpm monoblok size measure --root ../monoblok-main --out size-base.json

# Compare, and write the PR comment report
pnpm monoblok size compare size-head.json size-base.json --base-label main --markdown bundle-size.md
```

## Subtree commands (legacy)

The `subtree` commands imported standalone repositories into the monorepo with git subtrees. The
migration is complete, so the repository no longer has the `repo-manifest.json` they read. To import
another repository, create it in the monorepo root:

```json
{
  "@storyblok/region-helper": {
    "repo": "storyblok/region-helper",
    "branch": "main",
    "path": "packages/region-helper"
  }
}
```

| Field    | Description                                   |
| -------- | --------------------------------------------- |
| `repo`   | The GitHub repository in `owner/repo` format  |
| `branch` | The branch to sync from the source repository |
| `path`   | The destination path in the monorepo          |

```bash
# Add all manifest packages, or one
pnpm monoblok subtree add
pnpm monoblok subtree add region-helper

# Pull updates from the source repository
pnpm monoblok subtree pull region-helper [--force]

# Delete the package directory and re-import it
pnpm monoblok subtree rebuild region-helper [--yes]
```

After importing, remove the package's own CI workflows and any build-running `prepack` script,
archive the source repository, and delete `repo-manifest.json`.
