# Guidelines for Storyblok monoblok

Adhere strictly to these guidelines to ensure consistency and code quality. Use relevant skills if applicable.

## Project context

The `monoblok` repository is the official home for Storyblok open-source packages. It hosts core libraries, CLI tools, and various framework integrations.

Inspect the root `package.json` and the `packages/` directory to identify active projects and their current versions.

## Architecture patterns

- **Monorepo structure**: The project uses `nx` and `pnpm` workspaces for management.
  - `packages/`: Public packages and integrations.
  - `tools/`: Internal development tools and scripts.
- **Package naming**: Internal and published packages use the `@storyblok/` scope (with the exception of: `storyblok` (the CLI) and `storyblok-js-client`). Note that some folder names differ from their package names: `capi-client` → `@storyblok/api-client`, `mapi-client` → `@storyblok/management-api-client`, `cli` → `storyblok`, `js-client` → `storyblok-js-client`.
- **Dependencies**: Cross-package dependencies within the monorepo use the `workspace:*` protocol.
- **Tooling consistency**: Packages primarily use `vitest` for testing and `unbuild` for bundling.

## Code style and conventions

Always use linting and type-checking scripts for affected packages after making changes. When encountering lint errors, run the lint command with `--fix` first before attempting to fix issues manually.

### General

- **Language:** TypeScript.
- **Module System:** ESM (`"type": "module"` in `package.json`).

### Imports

- Use named imports where possible.
- Group imports:
  1. External dependencies (e.g., `commander`, `vitest`).
  2. Internal/Workspace dependencies (e.g., `@storyblok/...`).
  3. Local imports (relative paths).

## General

- **IMPORTANT:** Never stage or commit any code yourself unless explicitly told so!
