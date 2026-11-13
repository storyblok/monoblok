# Schema Command Playground

Test playground for `storyblok schema push`, `init`, and `rollback`, covering composability patterns
(`composability/`), schema versioning (`versions/`), and typed API client usage (`app/`).

## Setup

1. Create an empty space.
2. Log in and set the space ID:

   ```bash
   pnpm exec storyblok login
   export STORYBLOK_SPACE_ID=<your-space-id>
   ```

3. Install and build from the monorepo root:

   ```bash
   pnpm install
   pnpm nx run-many --target=build --parallel=3 -p=tag:npm:public
   ```

4. Run scripts from `packages/schema/playground/vanilla`.

## Commands

```bash
pnpm schema:init       # Scaffold a schema.ts from an existing space
pnpm schema:push       # Push base/schema.ts
pnpm schema:rollback
pnpm ver:1.0.0         # Push versions/v1.0.0.ts (also 1.1.0, 2.0.0)
pnpm validate          # Run app/validate.ts
pnpm exec storyblok schema push composability/schema.ts -s $STORYBLOK_SPACE_ID
```
