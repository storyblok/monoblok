# Storyblok monoblok Agent Guidelines

> **Note:** `AGENTS.md` is the source of truth. `CLAUDE.md` is a symlink to `AGENTS.md`.

## Rules

1. **Be concise** - Drop: filler, pleasantries, hedging.
2. **Small diffs** - One logical change per commit
3. **Plan first** - For non-trivial changes, write a plan before coding
4. **Verify always** - Run lint/typecheck/tests before considering work done
5. **No new deps** - Avoid adding dependencies unless strictly necessary

## Monorepo setup

The project uses `nx` and `pnpm` workspaces. Use commands like `pnpm nx build <package>` and `pnpm nx run-many` to build, test, lint, and run parallel CI checks across your projects. E.g., `pnpm nx build storyblok` or `pnpm nx lint:fix @storyblok/migrations`.

- `packages/`: Public packages and integrations.
- `tools/`: Internal development tools and scripts.
- Packages use the `@storyblok/` scope (with the exception of: `storyblok` (the CLI) and `storyblok-js-client`). Note that some folder names differ from their package names: `capi-client` → `@storyblok/api-client`, `mapi-client` → `@storyblok/management-api-client`, `cli` → `storyblok`, `js-client` → `storyblok-js-client`.

## Storyblok REST and Application Reference

- `../storyrails` (Storyblok backend) - Load when verifying REST/MAPI/CAPI schemas, error shapes, or endpoint behavior; `../storyrails/spec/integration/openapi/` is the source of truth.
- `../storyfront` (headless CMS frontend) - Load when matching UI/app behavior and you need information about the visual editor, bridge protocol, or rendering in the Storyblok UI.

These sibling repos may not be available; ignore them if absent. Check `../storyrails/monoblok.md` or `../storyfront/monoblok.md` file on how to consult the repo.

## Conventions

- **Naming:** Files `kebab-case.ts`, functions/variables `camelCase`, classes/types `PascalCase`, constants `UPPER_SNAKE_CASE`
- **Types:** Use `type` for object shapes, `interface` for extendable contracts. Avoid `as` type casts. Explicit return types on public APIs.
- **Imports:** Group as external deps → workspace deps (`@storyblok/...`) → local (relative paths). Prefer named imports.
- **Linting:** Always lint and type-check affected packages after making changes. Default to `lint:fix` or `--fix` and fix remaining issues.

## Architecture Decision Records

When a significant architectural decision is made, add a concise new ADR in `adr/` following the existing numbering convention (`0001-`, `0002-`, …).

## Git

- **IMPORTANT:** Never stage or commit any code yourself unless explicitly told so!
- **IMPORTANT:** Never add `Co-Authored-By` or similar AI attribution trailers to commit messages or PRs.
- **IMPORTANT:** Never use `git push --force`; if a force push is explicitly required, use `git push --force-with-lease` instead.
- **Branch naming:** `[fix|feat|chore]/WDX-XXX-[title]` e.g. `feat/WDX-351-type-safe-schema-support`, `fix/WDX-391-push-stories-missing-story-identification`, or `chore/update-eslint-config`.
- **Commits:** If information is available, add `Fixes WDX-*` and `Fixes #*` as footer lines at the end of commit messages for Linear and GitHub tracking.

**Worktrees:**

```bash
bash .agents/skills/blitz/scripts/monotree.sh add <branch-name>     # Create worktree
bash .agents/skills/blitz/scripts/monotree.sh remove <branch-name>  # Remove worktree
bash .agents/skills/blitz/scripts/monotree.sh list                  # List worktrees
```

Worktrees live in `.worktrees/<prefix>-<branch-name>` e.g., `.worktrees/fix-pulling-stories`.

## Docs

For more context, read relevant files in `docs/`:

- `announcements.md` - SDK announcement article format and tone. Load when drafting a release/announcement post.
- `cli-architecture.md` - CLI command patterns, UI module, migration checklist. Load when adding or modifying a `storyblok` CLI command.
- `docs-platform.md` - Docs site conventions, versioning, library doc paths. Load when editing docs site content or library docs.
- `storyblok-kotlin.md` - Kotlin Multiplatform SDK (Ktor plugin). Load when touching the Kotlin SDK.
- `storyblok-swift.md` - Swift SDK (URLSession extension). Load when touching the Swift SDK.
- `testing-patterns.md` - Windows compatibility gotchas, session mocking. Load when writing or debugging tests.
