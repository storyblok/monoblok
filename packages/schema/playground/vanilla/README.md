# CLI Schema Command — Manual Test Playground

Test playground for `storyblok schema push`, `init`, and `rollback`.

Includes:
- Composability patterns
- Versioning
- Use in a webapp, fully typed and using discriminated types for full Content types experience

## Setup

1. Create a space on Storyblok (or use an empty one).

2. Authenticate and set the space ID:

   ```bash
   storyblok login # or prefix it with pnpm (pnpm storyblok login) if you're running local version
   export STORYBLOK_SPACE_ID=<your-space-id>
   ```

3. Install dependencies and build (from monorepo root):

   ```bash
   pnpm install
   pnpm nx run-many --target=build --parallel=3 -p=tag:npm:public
   ```

4. Run scripts from this directory:

   ```bash
   cd packages/cli/playground/schema
   pnpm schema:push
   ```

## Quick test commands

```bash
pnpm schema:init          # Scaffold a schema.ts from a existing space (intended for single use)
pnpm schema:push          # Push main schema
pnpm schema:rollback  
pnpm composability        # Push the schema in composability/schema.ts
pnpm ver:1.0.0             # Push version 1.0.0
pnpm ver:1.1.0             # Push version 1.1.0
pnpm ver:2.0.0             # Push version 2.0.0
```
