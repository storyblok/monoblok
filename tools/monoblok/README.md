# Monoblok CLI

Internal CLI tool for managing the Storyblok monorepo.

## Setup

Build the CLI tool:

```bash
pnpm build:tools
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

| Field | Description |
|-------|-------------|
| `repo` | The GitHub repository in `owner/repo` format |
| `branch` | The branch to sync from the source repository |
| `path` | The destination path in the monorepo |

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

> **Warning**: The rebuild command deletes the package directory and re-imports it from the source repository.

### License management

The `license` commands help manage license compliance across the monorepo.

```bash
# Check licenses for a package
pnpm monoblok license check @storyblok/js
```

## Post-migration checklist

After migrating a package into the monorepo:

1. Remove the `prepack` script from the package's `package.json` if it runs a build command. The CI workflow builds all packages before publishing.
2. Remove standalone CI/CD workflows (GitHub Actions, etc.) from the package directory.
3. Update the package's README to point to the monorepo for issues and discussions.
4. Archive the original standalone repository.
5. Remove the package entry from `repo-manifest.json` once the source repository is archived.
