# Manually Test the @storyblok/management-api-client Package

`@storyblok/management-api-client` is the Management API (MAPI) client. The key things to validate manually are that the schema-aware `.withTypes()` integration correctly narrows story content, that every define helper produces a valid creation payload, and that Zod schemas accept real API responses.

## Automated e2e tests

`test/specs/mapi-round-trip.spec.e2e.ts` covers the full round-trip against a real Storyblok space:

- Seeds components, datasources, internal tags, presets, and stories via the MAPI.
- Validates runtime values, type narrowing, nested bloks (two- and three-level), unwhitelisted bloks, and update round-trips.
- Validates MAPI Zod schemas (`componentSchema`, `storySchema`, `datasourceSchema`, `datasourceEntrySchema`) against real API responses.

Run manually:

```bash
pnpm --filter @storyblok/management-api-client test:e2e
```

### Prerequisites

- A `.env.qa-engineer-manual` file at the repo root with `STORYBLOK_TOKEN` and `STORYBLOK_SPACE_ID`.
- `@storyblok/management-api-client` must be built first.

## Fetch via MAPI client and check content types

`stories.get(storyId)` takes a numeric/string ID as its first positional argument — there is no `getBySlug`. Fetch the ID from `stories.list` first:

```ts
import { createManagementApiClient } from '@storyblok/management-api-client';

const client = createManagementApiClient({ personalAccessToken: process.env.STORYBLOK_TOKEN, spaceId });
const list = await client.stories.list({ query: { per_page: 100 } });
const story = list.data?.stories?.find(s => s.slug === 'home');
const result = await client.stories.get(story.id);
console.info(result.data?.story?.content);
```

## Push component JSONs via the CLI

To push `defineComponent` components, serialize the component objects to JSON and stage them under `.storyblok/components/<space_id>/`:

```bash
node packages/cli/dist/index.mjs components push \
  --from qa-test \
  --space $STORYBLOK_SPACE_ID \
  --separate-files
```

**Always push components before stories.** The CLI validates that each story's `content.component` (and any nested block components) exist in the space. Pushing stories first fails if the referenced components are not yet present.

You can do the same with stories and `defineStory`. **Story filename convention:** the CLI requires files named `{slug}_{uuid}.json` where the part after the last `_` exactly matches `story.uuid` in the JSON. Use hyphens (not underscores) in UUIDs. A mismatch causes Pass 2 of the push (reference mapping + content update) to silently skip all stories.

## Known quirks

- **Stories require a content type component (`is_root: true`).** The MAPI rejects story creation with `"please select a content type component as your root component"` if the component used as the story root does not have `is_root: true`.
- **MAPI `stories.get` takes a positional ID, not an options object:** `client.stories.get(id)` — there is no `getBySlug`. The `list` response does not include `content`; call `get(id)` for full content.
- **MAPI client constructor uses `personalAccessToken`:** `createManagementApiClient({ personalAccessToken: '...', spaceId: ... })`.
- **Delete methods are `delete`:** Use `client.RESOURCE.delete(id)`.
- **Each story JSON must have a unique `id`.** `defineStory` defaults `id` to `1`. If multiple story files share the same `id`, the CLI's manifest maps all of them to the same `old_id` entry, causing "slug already taken" errors.
