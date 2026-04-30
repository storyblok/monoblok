# Guidelines for Storyblok monoblok

> **Note:** `AGENTS.md` is the source of truth. `CLAUDE.md` is a symlink to `AGENTS.md` for Claude Code compatibility.

Adhere strictly to these guidelines to ensure consistency and code quality. Be concise. Drop: filler, pleasantries, hedging.

## Project context

The `monoblok` repository is the official home for Storyblok open-source packages. It hosts core libraries, CLI tools, and various framework integrations.

Inspect the root `package.json` and the `packages/` directory to identify active projects and their current versions.

## Architecture patterns

- **Monorepo structure**: The project uses `nx` and `pnpm` workspaces for management.
  - `packages/`: Public packages and integrations.
  - `tools/`: Internal development tools and scripts.
- **Package naming**: Internal and published packages use the `@storyblok/` scope (with the exception of: `storyblok` (the CLI) and `storyblok-js-client`). Note that some folder names differ from their package names: `capi-client` → `@storyblok/api-client`, `mapi-client` → `@storyblok/management-api-client`, `cli` → `storyblok`, `js-client` → `storyblok-js-client`.
- **Dependencies**: Cross-package dependencies within the monorepo use the `workspace:*` protocol.
- **Tooling**: Packages use [Vite+](https://viteplus.dev) (`vp` CLI) as the unified toolchain — `vp pack`/`vp build` for bundling (tsdown / Vite under the hood), `vp test` for testing (Vitest), `vp lint` for linting (Oxlint via `@storyblok/lint-config`), and `vp fmt` for formatting (Oxfmt).

## Code style and conventions

Always use `lint:fix`, `format`, and `test:types` scripts for affected packages after making changes. When encountering lint errors, run the lint command with `--fix` first before attempting to fix issues manually.

### General

- **Language:** TypeScript.
- **Module System:** ESM (`"type": "module"` in `package.json`).

### Imports

- Use named imports where possible.
- Group imports:
  1. External dependencies (e.g., `commander`, `vitest`).
  2. Internal/Workspace dependencies (e.g., `@storyblok/...`).
  3. Local imports (relative paths).

### JSDoc

- Add JSDoc to exported functions and non-trivial internal helpers.
- Use concise one-liners (`/** Does X. */`) for simple functions.
- Use multi-line JSDoc with `@param`, `@returns`, and `@example` only for public-facing utilities where the signature isn't self-explanatory.
- Skip JSDoc on trivial code where the name and types already tell the full story.

## Architecture Decision Records

The `adr/` directory contains Architecture Decision Records (ADRs) documenting major technical decisions. When a significant architectural or dependency decision is made, add a new ADR following the existing numbering convention (`0001-`, `0002-`, …).

## General

- **IMPORTANT:** Never stage or commit any code yourself unless explicitly told so!
- **IMPORTANT:** Never add `Co-Authored-By` or similar AI attribution trailers to commit messages or PRs.
- **Branches:** Follow the current branch naming pattern: `<type>/<ticket-or-scope>-<short-description>`, e.g. `feature/WDX-351-type-safe-schema-support`, `bugfix/WDX-391-push-stories-missing-story-identification`, or `chore/update-eslint-config`.
- **Commits:** If ticket or issue information is available, add `Fixes WDX-*` and `Fixes #*` as footer lines at the end of commit messages for Linear and GitHub tracking.
- **IMPORTANT:** Never use `git push --force`; if a force push is explicitly required, use `git push --force-with-lease` instead.
- **Worktrees:** Always use the `.worktrees/` directory when creating git worktrees.
