# Release Process

Releasing a package takes two steps:

1. **Versioning:** `pnpm release` bumps versions, commits, tags, pushes, and creates GitHub
   releases.
2. **Publishing:** the **Publish** GitHub Actions workflow builds and publishes to npm.

## Prerequisites

Export a GitHub token with the `repo` scope as `GITHUB_TOKEN`. `nx release` uses it to create GitHub
releases.

## Versioning

Run the release script from a release branch (`main`, `alpha`, `beta`, `next`, or `rc`):

```bash
pnpm release
```

The script:

- Checks that you're on a release branch, without uncommitted changes, and up to date with the
  remote
- Skips packages whose `release.branches` excludes the current branch
- Runs `nx release --skip-publish`, which analyzes conventional commits since the last release,
  bumps versions, creates a `chore(release): publish` commit, creates `{project}@{version}` tags
  (for example `@storyblok/astro@7.2.0`), pushes, and creates a GitHub release per package
- Aborts if `nx release` bumped a package that isn't eligible on the current branch, and prints
  recovery steps

Release notes live in GitHub releases only. `nx.json` disables per-project `CHANGELOG.md` files.

### Options

| Option              | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `--version=<x.y.z>` | Set the version explicitly instead of deriving it from commits |
| `--projects=<list>` | Comma-separated package names to release                       |
| `--first-release`   | Release a package that has no previous release tag             |
| `--dry-run`, `-d`   | Print what would happen without changing anything              |

To release a specific version of one package, combine the options. This keeps the release-branch
guard in place, unlike calling `nx release` directly:

```bash
pnpm release --version=1.2.3 --projects=@storyblok/astro --dry-run
```

### Version bumps

Commit types determine the bump. Commitlint requires a scope:

- `fix(astro): …` → patch
- `feat(astro): …` → minor
- `feat(astro)!: …` or a `BREAKING CHANGE:` footer → major

`chore` commits never bump a version.

### Pre-release versions

Pre-release branches (`alpha`, `beta`, `next`, `rc`) produce versions with the branch name as
pre-release identifier, for example `1.0.0-alpha.0`:

```bash
git checkout alpha
git commit -m "feat(astro): add new feature"
git push origin alpha
pnpm release
```

Then run the **Publish** workflow on that branch.

To promote a pre-release to stable, merge the pre-release branch into `main`, run `pnpm release` on
`main`, and run the **Publish** workflow on `main`.

### Release channels per package

Each package's `release.branches` in its `package.json` defines the branches it may release from.
Packages without the field release from every release branch. To list the packages eligible on a
branch:

```bash
node tools/release-branches.mjs alpha
```

To keep a package out of stable releases, omit `"main"` from its `release.branches`. To promote it
to stable, add `"main"` back.

Three places enforce this:

1. `pnpm release` skips ineligible packages.
2. `pnpm release` aborts if `nx release` bumped an ineligible package's `version` anyway.
3. The **Publish** workflow recomputes the eligible list before publishing, so raw `nx release`
   flows can't publish an ineligible package either.

#### Pre-release-only packages and downstream consumers

Marking a package pre-release-only (for example
`release.branches: [{ "name": "alpha", "prerelease": true }]`) freezes its stable version on npm,
but doesn't stop nx from bumping its `version` field on `main` when conventional commits drive a
bump. Downstream packages that reference it via `workspace:^` then publish a caret range built from
that unpublished version. If nothing on npm satisfies the range, installing the consumer fails with
`ETARGET`. If something does, it silently resolves to a different version.

Two mitigations:

1. **Keep breaking changes on the pre-release branch.** Keep `main` at the last stable state of a
   pre-release-only package until it's ready to promote.
2. **The `pnpm release` guard** aborts before pushing when `main` accumulated bump-worthy commits
   for such a package. Follow the recovery steps it prints.

## Publishing

After `pnpm release` pushed the version commit:

```bash
gh workflow run publish.yaml --ref <branch>
```

Or run the **Publish** workflow from the GitHub Actions tab. The workflow publishes to npm via OIDC
trusted publishing, so no npm token is involved. It picks the npm distribution tag from the branch:

| Branch  | npm tag  |
| ------- | -------- |
| `main`  | `latest` |
| `next`  | `next`   |
| `beta`  | `beta`   |
| `alpha` | `alpha`  |
| `rc`    | `rc`     |

On `main`, it publishes every eligible package; versions already on npm are skipped. On pre-release
branches, it publishes only the eligible packages bumped in the latest `chore(release): publish`
commit.

## Workspace dependencies

Published packages reference each other with the `workspace:^` protocol:

```json
"dependencies": {
  "@storyblok/js": "workspace:^"
}
```

Locally, pnpm links these to the package in the monorepo. At pack time, `pnpm publish` replaces the
protocol with a caret range built from the dependency's current version, so a tarball built while
`@storyblok/js` sits at 6.3.1 carries `"@storyblok/js": "^6.3.1"`. Consumers then receive patches
and minors of that dependency on their next install.

nx never rewrites the specifier in the source manifest, because `release.version` sets
`preserveLocalDependencyProtocols: true` in `nx.json`. Keep that setting. Without it,
`nx release version` replaces every `workspace:^` with a literal resolved version inside the release
commit, and consumers are back to exact pins that only refresh when the dependent is released again.

Two rules follow:

- **Runtime sections** (`dependencies`, `peerDependencies`, `optionalDependencies`) of published
  packages use `workspace:^`.
- **`devDependencies`** keep `workspace:*`. Consumers never install them, so the range never reaches
  anyone, and `*` stays the clearest way to say "whatever is in the workspace".

Run `pnpm check:workspace-protocol` to verify both rules. CI runs it on every build.

### Caret ranges on pre-release channels

A caret range is resolved at install time against whatever npm offers, which interacts awkwardly
with pre-release versions. When a package is packed while its workspace dependency sits at a
pre-release version, the published range looks like `^7.8.0-next.0`, and semver reads that as
`>=7.8.0-next.0 <8.0.0`. Stable `7.8.0` and `7.9.0` both satisfy it.

An artifact published from `next` can therefore resolve a **stable** dependency rather than the
pre-release it was built against, and two installs of the same artifact on different days can end up
with different trees.

This affects any edge where a package **and** its workspace dependency both release from the same
pre-release channel, because only then is the dependency at a pre-release version when the dependent
is packed. A dependency that releases from `main` only is never at a pre-release version, so its
published range is an ordinary caret and this doesn't apply.

This is accepted rather than solved. Pre-release consumers are already opted into instability, and
the alternatives (per-branch specifier overrides, publish-time channel checks) cost more than the
risk. If a pre-release branch genuinely needs a dependency version that stable doesn't have, pin
that single edge to an exact version on that branch instead of relying on the caret.

## Troubleshooting

### Failed GitHub release creation

```bash
git tag --sort=-creatordate | head -5
gh release create @storyblok/astro@7.2.0 --title "@storyblok/astro@7.2.0" --generate-notes
```

### Failed version commit or tag push

```bash
git push origin <branch>
git push origin --tags
```

### Partially completed versioning

Check what exists with `git log --oneline -5`, `git tag --sort=-creatordate | head -5`, and
`git status`, then finish the missing steps:

```bash
git commit -am "chore(release): publish"
git tag @storyblok/astro@7.2.0
git push origin <branch> --tags
```

### Roll back a release

Only roll back releases that weren't published to npm yet:

```bash
git tag -d @storyblok/astro@7.2.0
git push origin :refs/tags/@storyblok/astro@7.2.0
gh release delete @storyblok/astro@7.2.0
git revert <release-commit-sha>
git push origin <branch>
```
