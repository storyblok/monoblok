# CLI Schema Command — Manual Test Playground

Test playground for `storyblok schema push`, `pull`, and `rollback`.

## Setup

1. Create a **dedicated test space** on Storyblok (or use an empty one).

2. Authenticate and set the space ID:

   ```bash
   storyblok login
   export STORYBLOK_SPACE_ID=<your-space-id>
   ```

3. Install dependencies (from monorepo root):

   ```bash
   pnpm install
   pnpm nx build cli && pnpm nx build schema
   ```

4. Run scripts from this directory:

   ```bash
   cd packages/cli/playground/schema
   ```

## Schema files

| File | Purpose |
|---|---|
| `schema.ts` | Main schema — 5 components, 2 folders, 2 datasources |
| `variants/schema-v2.ts` | Breaking changes: rename, remove, type change, new required field |
| `variants/schema-minimal.ts` | Single component, no folders/datasources |
| `variants/schema-direct.ts` | Direct exports pattern + ignored non-schema exports |
| `versions/v1.0.0..v2.0.0` | Versioned evolution (see VERSIONING.md) |
| `composability/schema.ts` | All 5 composability patterns demo |

## Quick test commands

```bash
pnpm schema:push          # Push main schema (--delete)
pnpm schema:push:dry      # Dry-run main schema
pnpm schema:pull           # Pull remote to pulled/
pnpm schema:rollback:latest # Rollback last push
pnpm ver:1.0.0             # Push version 1.0.0
pnpm composability         # Push composability demo
```

See VERSIONING.md for full versioned test flows.
