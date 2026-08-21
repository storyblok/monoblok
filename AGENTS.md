# Storyblok monoblok

We use `nx` and `pnpm` workspaces. Use commands like `pnpm nx build <package>` and
`pnpm nx run-many` to build, test, lint, and run parallel CI checks across projects. E.g.,
`pnpm nx build storyblok` or `pnpm nx lint:fix @storyblok/migrations`.

- `packages/`: Public packages and integrations.
- `tools/`: Internal development tools and scripts.
- Packages use the `@storyblok/` scope (with the exception of: `storyblok` (the CLI) and
  `storyblok-js-client`). Note that some folder names differ from their package names: `capi-client`
  → `@storyblok/api-client`, `mapi-client` → `@storyblok/management-api-client`, `cli` →
  `storyblok`, `js-client` → `storyblok-js-client`.
- Packages use [Vite+](https://viteplus.dev) (`vp` CLI) as the unified toolchain:
  `vp pack`/`vp build` for bundling (tsdown / Vite under the hood), `vp test` for testing (Vitest),
  `vp lint` for linting (Oxlint via `@storyblok/lint-config`), and `vp fmt` for formatting (Oxfmt).
  Formatting is run from the repo root (`pnpm format`), not per package.

## Rules

- **Be concise** - Drop: filler, pleasantries, hedging.
- **Plan first** - For non-trivial changes, write a plan before coding
- **Verify always** - Run lint/typecheck/tests before considering work done
- **Reuse first** - Before implementing, search for existing utilities, helpers, and modules in the
  package. Prefer composing over writing new.
- **Check versions** - Look up the latest version before installing a new npm package.

## Sibling repos

- `../storyrails` (Storyblok backend) - Consult when verifying REST/MAPI/CAPI schemas, error shapes,
  or endpoint behavior; `../storyrails/spec/integration/openapi/` is the source of truth.
- `../storyfront` (headless CMS frontend) - Consult when matching UI/app behavior and you need
  information about the visual editor, bridge protocol, or rendering in the Storyblok UI.
- `../storyblok-bridge` (Storyblok Bridge) - Consult when verifying bridge behavior: the
  `postMessage` protocol between the editor and a preview iframe, the editable-block attributes it
  writes into the page, the overlay/click-to-edit UI, or the bridge lifecycle.
- `../storyblok-docs-platform` (docs site) - Consult when publishing or updating package reference
  docs; see `docs/docs-platform.md` for the monoblok-side conventions. User-facing documentation
  lives there, not here: package READMEs stay minimal and link to the docs site.

These sibling repos may not be available; ignore them if absent.

- **IMPORTANT:** `../storyrails`, `../storyfront` and `../storyblok-bridge` are private. Never
  reference them, their paths, file names, or internal implementation details in commit messages, PR
  titles and descriptions, issue comments, code comments, or any other public-facing text. Describe
  the observable API or behavior instead.

## Conventions

- **Naming:** Files `kebab-case.ts`, functions/variables `camelCase`, classes/types `PascalCase`,
  constants `UPPER_SNAKE_CASE`
- **Types:** Use `type` for object shapes, `interface` for extendable contracts. Avoid `as` type
  casts. Explicit return types on public APIs.
- **Imports:** Group as external deps → workspace deps (`@storyblok/...`) → local (relative paths).
  Prefer named imports.
- **Linting:** Always lint and type-check affected packages after making changes. Default to
  `lint:fix` or `--fix` and fix remaining issues.

## OpenAPI codegen

`tools/openapi-codegen/` owns OpenAPI spec fetching, the committed overlay specs in
`tools/openapi-codegen/specs/`, and the shared generator. Consumer packages commit their
`src/generated/` output so external contributors can build without spec access and so type-relevant
spec changes surface as reviewable diffs. The commit-generated-code rule applies to OpenAPI codegen
output specifically, not all generated code in the repo! Read `tools/openapi-codegen/README.md` when
working with OpenAPI specs.

- **IMPORTANT:** After changing anything under `tools/openapi-codegen/`, including the committed
  specs in `specs/`, regenerate **every** consumer with `pnpm nx run-many -t generate:openapi` and
  commit the resulting `packages/*/src/generated/` diff. Never regenerate only the package you are
  working on: the consumers export the same public types, so a partial regeneration makes them
  disagree, and nothing in CI catches it.
- Editing `specs/` does not move `spec.lock`, so there is no lock diff to hint that regeneration is
  due.

## Architecture Decision Records

When a significant architectural decision is made, add a concise new ADR in `adr/` following the
existing numbering convention (`0001-`, `0002-`, …).

## Git

- **IMPORTANT:** On `main`, only stage or commit when explicitly asked to.
- **IMPORTANT:** Never use `git push --force`; if a force push is explicitly required, use
  `git push --force-with-lease` instead.
- **Branch naming:** `[fix|feat|chore]/DX-XXX-[title]` e.g. `feat/DX-351-type-safe-schema-support`,
  `fix/DX-391-push-stories-missing-story-identification`, or `chore/update-eslint-config`.
- **Commits:** If information is available, add `Fixes DX-*` and `Fixes #*` as footer lines at the
  end of commit messages for Linear and GitHub tracking.

**Worktrees:**

```bash
bash .agents/skills/blitz/scripts/monotree.sh add <branch-name>     # Create worktree
bash .agents/skills/blitz/scripts/monotree.sh remove <branch-name>  # Remove worktree
bash .agents/skills/blitz/scripts/monotree.sh list                  # List worktrees
```

Worktrees live in `.worktrees/<prefix>-<branch-name>` e.g., `.worktrees/fix-pulling-stories`.

## Docs

For more context, read relevant files in `docs/`:

- `announcements.md` - announcement article format and tone. Load when drafting a
  release/announcement post.
- `docs-platform.md` - Docs site conventions: library doc paths, versioning, badges, space IDs. Load
  when changes need reference docs, when versioning docs for a major release, or when adding a
  package to the site navigation.
- `storyblok-kotlin.md` - Kotlin Multiplatform SDK (Ktor plugin). Load when touching the Kotlin SDK.
- `storyblok-swift.md` - Swift SDK (URLSession extension). Load when touching the Swift SDK.
- `testing-patterns.md` - Test stack, file layout, session mocking, and Windows gotchas. Load when
  writing, debugging, or reviewing tests.
