# @storyblok/playground-mapi-schema

Integration tests for [`@storyblok/management-api-client`](../../) paired with [`@storyblok/schema`](../../../schema).

This playground exists so the management-api-client package itself stays free of a runtime dependency on `@storyblok/schema`, while still letting us verify that the two packages line up.

## Type tests

`test/types/*.test-d.ts` assert that `defineBlock` / `defineX*` payloads from `@storyblok/schema` are assignable to the corresponding MAPI request bodies, and that `.withTypes()` narrows responses correctly. They run in CI:

```bash
pnpm --filter @storyblok/playground-mapi-schema test
pnpm --filter @storyblok/playground-mapi-schema test:types
```

## End-to-end tests

`test/specs/*.spec.e2e.ts` exercise a real round-trip against the Storyblok MAPI using a personal access token. Run manually only:

```bash
pnpm --filter @storyblok/playground-mapi-schema test:e2e
```

Requires `.env.qa-engineer-manual` at the repo root with `STORYBLOK_TOKEN` and `STORYBLOK_SPACE_ID`.
