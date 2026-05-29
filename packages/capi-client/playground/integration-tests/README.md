# @storyblok/capi-integration-tests

Integration tests for [`@storyblok/api-client`](../../) paired with [`@storyblok/schema`](../../../schema).

This playground exists so the api-client package itself stays free of a runtime dependency on `@storyblok/schema`, while still letting us verify that the two packages line up.

## Type tests

`test/types/*.test-d.ts` assert that `defineBlock` payloads from `@storyblok/schema` flow into the CAPI client's `.withTypes()` narrowing. They run in CI:

```bash
pnpm --filter @storyblok/capi-integration-tests test
pnpm --filter @storyblok/capi-integration-tests test:types
```

## End-to-end tests

`test/specs/*.spec.e2e.ts` exercise a real round-trip against the Storyblok CAPI (with MAPI used as a writer) using a personal access token. Run manually only:

```bash
pnpm --filter @storyblok/capi-integration-tests test:e2e
```

Requires `.env.qa-engineer-manual` at the repo root with `STORYBLOK_TOKEN` and `STORYBLOK_SPACE_ID`.
