# Contributing to Storyblok SDKs

## Setup

Prerequisites: Git, Node.js (version in [`.nvmrc`](.nvmrc)), and pnpm.

```bash
git clone https://github.com/storyblok/monoblok.git
cd monoblok
pnpm install
```

`pnpm install` also builds the internal `monoblok` CLI in [`tools/monoblok`](tools/monoblok).
Rebuild it with `pnpm --filter monoblok-cli build` only when changing it.

## Commands

```bash
# Build all packages, or one
pnpm build
pnpm nx build @storyblok/react

# Test, type-check, lint
pnpm test
pnpm test:types
pnpm lint
pnpm lint:fix

# Format with Oxfmt
pnpm format

# Watch-build a single package while developing
pnpm --filter @storyblok/react dev

# Re-run a package's tests on change
pnpm --filter @storyblok/migrations test:watch

# Add a dependency to a package
pnpm add <package> --filter @storyblok/react
```

## Commit messages and PR titles

Use [Conventional Commits](https://www.conventionalcommits.org/) with a mandatory scope: a package
folder name under `packages/` (for example `feat(cli): …`) or one of `release`, `repo`, `deps`,
`ci`, `docs`, `tools`, or `agents`. Commitlint checks commits and PR titles; the PR title becomes
the squash commit message.

`fix` and `feat` release the package, so use them only for changes its consumers can observe. Use
`chore` for tests, playgrounds, tooling, CI, and repository docs. See [RELEASING.md](RELEASING.md).

## Tests

Test observable behavior from the consumer's perspective, not implementation details. See
[`docs/testing-patterns.md`](docs/testing-patterns.md) for the test stack and conventions.

## Documentation

User-facing documentation lives on the [Storyblok docs site](https://www.storyblok.com/docs), not in
package READMEs, which stay minimal. While a PR is open, draft docs in a `DOCS.md` as described in
[`docs/docs-platform.md`](docs/docs-platform.md).

## PR previews

Every push to a branch in this repository other than `main` publishes preview builds of all public
packages through [pkg.pr.new](https://pkg.pr.new). The pkg.pr.new bot posts the install commands on
the pull request.

## Questions

Open an issue in this repository or join the
[Discord community](https://storyblok.com/join-discord).
