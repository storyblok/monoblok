# Release Process

This document details the release process for Storyblok packages in the monorepo.

## Overview

The release process is split into two main steps:
1. **Versioning**: Increment versions and create version commits
2. **Publishing**: Build and publish packages to npm with appropriate distribution tags

This separation allows for better control and review of version changes before they are published.

## Prerequisites

### GitHub Personal Access Token Setup

To perform releases that create GitHub releases, you need to configure a GitHub personal access token locally:

1. **Create a Personal Access Token**:
   - Go to [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a descriptive name (e.g., "Monoblok Releases")
   - Set an expiration date
   - Select the following scopes:
     - `repo` (Full control of private repositories)
     - `write:packages` (Upload packages to GitHub Package Registry)
   - Click "Generate token"
   - **Copy the token immediately** (you won't be able to see it again)

2. **Configure the Token Locally**:

   Add the token to your shell environment. Choose one of these methods:

   **Option A: Add to your shell profile** (recommended for permanent setup):
   ```bash
   # For bash (~/.bashrc or ~/.bash_profile)
   echo 'export GITHUB_TOKEN="your_token_here"' >> ~/.bashrc
   source ~/.bashrc

   # For zsh (~/.zshrc)
   echo 'export GITHUB_TOKEN="your_token_here"' >> ~/.zshrc
   source ~/.zshrc
   ```

   **Option B: Set for current session only**:
   ```bash
   export GITHUB_TOKEN="your_token_here"
   ```

3. **Verify the Token**:
   ```bash
   echo $GITHUB_TOKEN
   ```

**Note**: Never commit your token to the repository. The token is only needed locally when running `nx release` commands that create GitHub releases.

## Versioning

There are two ways to handle versioning, depending on your needs:

### Full Release (with GitHub Release)

To create a release with automatic version increments and a GitHub release, use the dedicated release script:

```bash
pnpm release
```

This script will:
- Check that you're on the `main` branch
- Check for uncommitted changes
- Fetch the latest changes from remote
- Verify you're up to date with `origin/main`
- Run `nx release --skip-publish` to:
  - Analyze conventional commits since the last release
  - Determine appropriate version bumps
  - Create version commits
  - Create git tags
  - Push changes to the repository
  - Generate changelogs
  - Create a GitHub release

**Important**: The script enforces these prerequisites automatically. If any check fails, it will provide clear instructions on how to fix the issue before proceeding.

### Silent Versioning (without GitHub Release)

For release candidates or silent releases, use the version command:

```bash
pnpm nx release version
```

This will:
- Analyze conventional commits since the last release
- Determine appropriate version bumps
- Create version commits
- Create git tags
- Push changes to the repository
- Generate changelogs
- Skip creating a GitHub release

### Manual Versioning

To create a release with a specific version:

```bash
# With GitHub release
pnpm nx release 1.2.3 --skip-publish

# Without GitHub release
pnpm nx release version 1.2.3
```

### Version Bumps

Version increments are determined by commit messages:
- `feat:` → minor version bump
- `fix:` → patch version bump
- `BREAKING CHANGE:` or `feat!:` → major version bump

## Publishing

After versioning and pushing your changes:

1. Go to the GitHub Actions tab
2. Select the "Publish" workflow
3. Click "Run workflow"
4. Select the branch where you pushed your version commit
5. Click "Run workflow"

The publish workflow will:
- Build all packages
- Handle workspace dependencies
- Publish to npm with the appropriate distribution tag:
  - `main` branch → `latest` tag
  - `next` branch → `next` tag
  - `beta` branch → `beta` tag
  - `alpha` branch → `alpha` tag

## Distribution Tags

Users can install specific versions using the appropriate tag:

```bash
# Latest stable version
npm install @storyblok/package

# Next version
npm install @storyblok/package@next

# Beta version
npm install @storyblok/package@beta

# Alpha version
npm install @storyblok/package@alpha
```

## Release Branches

The repository uses different branches for different types of releases:

- `main`: Stable releases
- `next`: Next version releases
- `beta`: Beta releases
- `alpha`: Alpha releases

Each branch corresponds to a specific npm distribution tag, ensuring users can install the appropriate version for their needs.

## Best Practices

1. Always use `pnpm release` to ensure you're on the `main` branch with the latest changes
2. Review version commits before pushing
3. Ensure all tests pass before publishing
4. Use conventional commits for automatic versioning
5. Document breaking changes in commit messages
6. Test the published package before announcing the release
7. Use `nx release version` for release candidates or when you don't want to create a GitHub release
8. Use `pnpm release` for full releases that should be announced via GitHub

## Troubleshooting

### Failed GitHub Release Creation

If the release process fails to create a GitHub release, you can create it manually:

#### Option 1: Using GitHub CLI

```bash
# List recent tags to find your release tag
git tag --sort=-creatordate | head -5

# Create a GitHub release for a specific tag
gh release create v1.2.3 --title "v1.2.3" --notes "Release notes here"

# Or generate notes automatically from commits
gh release create v1.2.3 --generate-notes
```

#### Option 2: Using GitHub Web Interface

1. Go to your repository on GitHub
2. Click on "Releases" in the right sidebar
3. Click "Draft a new release"
4. Click "Choose a tag" and select the tag created by the release process (e.g., `v1.2.3`)
5. Set the release title (usually the version number, e.g., `v1.2.3`)
6. **Generate release notes**:
   - Click "Generate release notes" button to automatically create notes from commits between tags
   - Or manually add release notes by copying from CHANGELOG.md
   - Edit the generated notes as needed to highlight important changes
7. Select "Set as the latest release" if this is a stable release
8. Click "Publish release"

**Tip**: The "Generate release notes" feature automatically categorizes commits and credits contributors, which can save time compared to manually writing notes.

### Failed Version Commit/Tag Push

If versioning succeeded locally but failed to push:

```bash
# Check what tags exist locally but not on remote
git tag -l | while read tag; do
  if ! git ls-remote --tags origin | grep -q "refs/tags/$tag"; then
    echo "$tag (not pushed)"
  fi
done

# Push tags manually
git push origin --tags

# Push version commits
git push origin main  # or your target branch
```

### Failed Versioning Process

If `pnpm release` or `nx release version` fails partway through:

1. **Check what was completed**:
   ```bash
   # Check if version commits were created
   git log --oneline -5

   # Check if tags were created locally
   git tag --sort=-creatordate | head -5

   # Check if changes were pushed
   git status
   ```

2. **Complete the process manually**:
   ```bash
   # If versions were bumped but not committed
   git add .
   git commit -m "chore(release): publish"

   # If commits exist but tags weren't created
   # Check package.json files for new versions, then create tags
   git tag v1.2.3

   # If tags exist but weren't pushed
   git push origin main --tags
   ```

3. **If the release process partially completed**:
   - Check CHANGELOG.md files to see if they were updated
   - Verify package.json versions were incremented
   - Complete any missing steps manually using the commands above

### Rollback a Failed Release

If you need to undo a release:

```bash
# Delete the local tag
git tag -d v1.2.3

# Delete the remote tag
git push origin :refs/tags/v1.2.3

# Delete the GitHub release (using gh CLI)
gh release delete v1.2.3

# Revert the version commits
git revert HEAD~1  # adjust the number based on commits to revert
git push origin main
```

### Common Error Messages

- **"GITHUB_TOKEN not found"**: Set up your GitHub token as described in Prerequisites
- **"No commits since last release"**: Ensure you have commits following conventional commit format
- **"Authentication failed"**: Check your NPM_TOKEN and GITHUB_TOKEN credentials
- **"Tag already exists"**: The version has already been tagged. Use `git tag -d <tag>` to delete if needed 
