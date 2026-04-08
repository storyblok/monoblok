# Manually Test the @storyblok/api-client Package

`@storyblok/api-client` is the Content Delivery API (CAPI) client. The key things to validate manually are that the schema-aware `.withTypes()` integration returns properly narrowed types, that nested blok fields resolve correctly (not to `never`), and that Zod schemas accept real API responses.

## Automated e2e tests

`test/specs/capi-round-trip.spec.e2e.ts` covers the full round-trip against a real Storyblok space:

- Seeds components and a story via the MAPI, publishes the story, then reads it back through the CAPI using the space's preview token.
- Validates type narrowing, nested bloks (two- and three-level), and unwhitelisted bloks through `stories.get` and `stories.list`.
- Validates CAPI Zod schemas (`storySchema`, `spaceSchema`) against real API responses.

Run manually:

```bash
pnpm --filter @storyblok/api-client test:e2e
```

### Prerequisites

- A `.env.qa-engineer-manual` file at the repo root with `STORYBLOK_TOKEN` and `STORYBLOK_SPACE_ID`.
- Both `@storyblok/api-client` and `@storyblok/management-api-client` must be built first.

## Fetch via the CAPI client and check content types

```ts
import { createApiClient } from '@storyblok/api-client';

const client = createApiClient({
  accessToken: process.env.STORYBLOK_PREVIEW_TOKEN,
}).withTypes<{ components: typeof pageComponent | typeof teaserComponent }>();

const result = await client.stories.get('home', { query: { version: 'draft' } });
const story = result.data?.story;
// At runtime: verify the discriminant and field types match what was pushed
if (story?.content?.component === 'page') {
  console.info(typeof story.content.headline); // 'string'
  console.info(typeof story.content.rating);   // 'number'
}
```

The `.withTypes<{ components: ... }>()` method narrows `story.content` to a discriminated union of your component types. It has zero runtime cost — the type parameter is erased at compile time.

## Known quirks

- **CAPI requires published stories** (or `version: 'draft'` with a preview token). Pass `query: { version: 'draft' }` when fetching freshly-created stories that have not been published.
- **`stories.get` takes a slug string as its first argument:** `client.stories.get('my-slug')`.
- **`stories.list` does not include `content`:** Use `stories.get(slug)` for full content.
