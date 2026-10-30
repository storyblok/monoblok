# Monoblok CLI

Internal CLI tool for managing the Storyblok monorepo. `pnpm install` builds it via its
`postinstall` hook. Rebuild it with `pnpm --filter monoblok-cli build` after changing it.

## License check

```bash
pnpm monoblok license check @storyblok/js
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
