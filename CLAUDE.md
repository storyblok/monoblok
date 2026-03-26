# CLAUDE.md - Monoblok

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

### Worktrees

```bash
bash .claude/skills/blitz/scripts/monotree.sh add <branch-name>     # Create worktree
bash .claude/skills/blitz/scripts/monotree.sh remove <branch-name>  # Remove worktree
bash .claude/skills/blitz/scripts/monotree.sh list                  # List worktrees
```

Branch naming: `[fix|feat|chore]/WDX-XXX-[title]`

## API Reference

The **source of truth** for Storyblok Management API schemas is the **storyrails** repo (`spec/integration/openapi/`), not the local `packages/openapi` spec which may lag behind. Flag inconsistencies to the user.
