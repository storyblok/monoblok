# Monoblok

Storyblok's monorepo for all JavaScript SDKs and tools. Uses pnpm workspaces + Nx.

## Rules

1. **Small diffs** - One logical change per commit
2. **Plan first** - For non-trivial changes, write a plan before coding
3. **Verify always** - Run lint/typecheck/tests before considering work done
4. **No new deps** - Avoid adding dependencies unless strictly necessary

## Commands

```bash
pnpm install                                                        # Setup
pnpm nx build cli                                                   # Build single package
pnpm nx test cli                                                    # Test single package
pnpm nx lint cli                                                    # Lint single package
pnpm nx run cli test:types                                          # Typecheck single package
pnpm nx run-many --target=build,lint,test,test:types --parallel=3   # CI check (run before PR)
pnpm --filter storyblok test -- --watch                             # Watch mode (cli)
```

Branch naming: `[fix|feat|chore]/WDX-XXX-[title]`

## Code conventions

- **Naming:** Files `kebab-case.ts`, functions/variables `camelCase`, classes/types `PascalCase`, constants `UPPER_SNAKE_CASE`
- **Types:** Use `type` for object shapes, `interface` for extendable contracts. Explicit return types on public APIs.
- **Imports:** Group as external deps → workspace deps (`@storyblok/...`) → local (relative paths). Prefer named imports.
- **Linting:** Run `pnpm nx lint <pkg> --fix` first before fixing lint errors manually.

## API Reference

The **source of truth** for Storyblok Management API schemas is the **storyrails** repo (`spec/integration/openapi/`), not the local `packages/openapi` spec which may lag behind. Flag inconsistencies to the user.

## Context files

For deeper context on specific areas, read the relevant file in `.claude/context/`:

- `cli-architecture.md` - CLI command patterns, UI module, migration checklist
- `testing-patterns.md` - Windows compatibility gotchas, session mocking
- `storyrails.md` - Backend API behavior, error patterns, auth methods
- `storyfront.md` - Visual editor bridge protocol between SDKs and Storyblok UI
- `docs-platform.md` - Docs site conventions, versioning, library doc paths
- `announcements.md` - SDK announcement article format and tone
- `storyblok-kotlin.md` - Kotlin Multiplatform SDK (Ktor plugin)
- `storyblok-swift.md` - Swift SDK (URLSession extension)
