# Monoblok CLI

Internal CLI tool for managing the Storyblok monorepo.

## Setup

The CLI is built automatically on `pnpm install` (via its `postinstall` hook). To rebuild it
manually:

```bash
pnpm --filter monoblok-cli build
```

## Commands

### Subtree management

The `subtree` commands help migrate standalone repositories into the monorepo using git subtrees.

#### Configuration

Create a `repo-manifest.json` file in the monorepo root to define packages for migration:

```json
{
  "@storyblok/region-helper": {
    "remote": "storyblok-region-helper",
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

#### Add a subtree

Add a package from a standalone repository into the monorepo:

```bash
# Add all packages defined in repo-manifest.json
pnpm monoblok subtree add

# Add a specific package
pnpm monoblok subtree add region-helper
```

The command:

1. Adds a git remote for the source repository
2. Imports the repository content into the specified path
3. Preserves the commit history from the source repository

#### Pull updates

Pull the latest changes from a source repository:

```bash
# Pull updates for all packages
pnpm monoblok subtree pull

# Pull updates for a specific package
pnpm monoblok subtree pull region-helper

# Force pull (use with caution)
pnpm monoblok subtree pull region-helper --force
```

#### Rebuild a subtree

Remove and re-add a subtree to resolve conflicts or reset the state:

```bash
# Interactive rebuild
pnpm monoblok subtree rebuild region-helper

# Non-interactive rebuild (auto-confirm)
pnpm monoblok subtree rebuild region-helper --yes
```

> **Warning**: The rebuild command deletes the package directory and re-imports it from the source
> repository.

### License management

The `license` commands help manage license compliance across the monorepo.

```bash
# Check licenses for a package
pnpm monoblok license check @storyblok/js
```

### Bundle size

The `size` commands guard the size of what each package ships. On every PR, the `Bundle size`
workflow builds the PR and its base branch in parallel, measures both builds with the PR's
`size measure`, and compares them with `size compare`. Nothing is committed as a baseline: the base
branch is the baseline. The report is posted as a PR comment, updated on every push, and only PRs
that change a size get one. PRs from forks get the report in the job summary only, since their token
can't comment.

Every package under `packages/` is measured, except the ones in `IGNORED_PACKAGES` in
`src/commands/size/size.ts`, which never reach a browser (the CLI, the lint config). A new package
is measured without any setup. Only files that `files` in `package.json` publishes from `dist` are
measured, gzipped, without type declarations, source maps, or tests. Each package gets:

| Measurement | What it covers                                                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entries     | Each file `exports` (or `main`, `module`, `unpkg`, …) points to, plus the files it statically imports from the package: what a consumer loads for that import. Dynamic imports load lazily and are left out, and so are dependencies. |
| Totals      | Every file, summed per format (`esm`, `cjs`, `umd`, `css`).                                                                                                                                                                           |
| Files       | Every file on its own, matched across builds by its path. Chunk file names must not carry a content hash, or they never match.                                                                                                        |

An entry or total fails the check when it grows more than 5% **and** 200 B, a file more than 5%
**and** 500 B, so a small file can't fail on a few bytes. CommonJS growth is reported but never
fails, since it is not what a browser receives. A package that is not built, or whose export points
to a file the build did not emit, always fails.

If the growth is intended, add the `bundle-size-accepted` label to the PR and re-run the failed
`compare` job. Growth is then reported as a warning.

```bash
# Measure the current build output (build first)
pnpm nx run-many -t build --exclude=storyblok
pnpm monoblok size measure --out size-head.json

# Measure another build, e.g. a copy of `packages/*/{package.json,dist}` from main
pnpm monoblok size measure --root ../main-build --out size-base.json

# Compare, and write the PR comment report
pnpm monoblok size compare size-head.json size-base.json --base-label main --markdown bundle-size.md
```

## Post-migration checklist

After migrating a package into the monorepo:

1. Remove the `prepack` script from the package's `package.json` if it runs a build command. The CI
   workflow builds all packages before publishing.
2. Remove standalone CI/CD workflows (GitHub Actions, etc.) from the package directory.
3. Update the package's README to point to the monorepo for issues and discussions.
4. Archive the original standalone repository.
5. Remove the package entry from `repo-manifest.json` once the source repository is archived.
