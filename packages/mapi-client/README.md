# @storyblok/management-api-client

A TypeScript SDK for the Storyblok Management API with automatic region resolution, built-in preventive rate limiting, and configurable retry logic.

## Features

- **Type-Safe**: Generated from OpenAPI specifications with full TypeScript support
- **Factory Function**: `createManagementApiClient(config)` — no class instantiation
- **Region Resolution**: Automatic regional endpoint selection based on space ID
- **Preventive Rate Limiting**: Token-bucket throttling to avoid hitting API rate limits before they occur
- **Retry Logic**: Built-in retry with exponential backoff and `Retry-After` header support
- **Multi-Resource**: Unified client for all Storyblok Management API resources

## Installation

```bash
npm install @storyblok/management-api-client
# or
pnpm add @storyblok/management-api-client
```

## Quick Start

```typescript
import { createManagementApiClient } from '@storyblok/management-api-client';

const client = createManagementApiClient({
  accessToken: 'your-personal-access-token',
  region: 'eu', // 'eu' | 'us' | 'ap' | 'ca' | 'cn'
});

// Get all stories
const stories = await client.stories.getAll({
  path: { space_id: 123456 },
  query: { per_page: 10 },
});

// Create a datasource
const datasource = await client.datasources.create({
  path: { space_id: 123456 },
  body: {
    datasource: {
      name: 'My Datasource',
      slug: 'my-datasource',
    },
  },
});
```

## Authentication

### Personal Access Token

```typescript
const client = createManagementApiClient({
  accessToken: 'your-personal-access-token',
});
```

### OAuth Token

```typescript
const client = createManagementApiClient({
  oauthToken: 'your-oauth-token',
});
```

## Configuration

```typescript
interface ManagementApiClientConfig {
  /** Personal access token. Provide either `accessToken` or `oauthToken`. */
  accessToken?: string;
  /** OAuth bearer token. Provide either `accessToken` or `oauthToken`. */
  oauthToken?: string;
  /** Storyblok region. Auto-detected from space ID if omitted. @default 'eu' */
  region?: 'eu' | 'us' | 'ap' | 'ca' | 'cn';
  /** Override base URL entirely (e.g. for testing). */
  baseUrl?: string;
  /** Additional request headers. */
  headers?: Record<string, string>;
  /** Throw on HTTP errors. @default false */
  throwOnError?: boolean;
  /** Request timeout in milliseconds. @default 30_000 */
  timeout?: number;
  /** Retry configuration. */
  retry?: {
    limit?: number;        // @default 12
    backoffLimit?: number; // @default 20_000 ms
    methods?: string[];
    statusCodes?: number[];
  };
  /** Preventive rate limiting. @default { maxConcurrent: 6, adaptToServerHeaders: true } */
  rateLimit?: {
    maxConcurrent?: number;        // @default 6
    adaptToServerHeaders?: boolean; // @default true
  } | number | false;
}
```

## Available Resources

```typescript
// Stories
await client.stories.getAll({ path: { space_id } });
await client.stories.get({ path: { space_id, story_id } });
await client.stories.create({ path: { space_id }, body: { story: { ... } } });
await client.stories.update({ path: { space_id, story_id }, body: { story: { ... } } });
await client.stories.delete({ path: { space_id, story_id } });

// Assets
await client.assets.getAll({ path: { space_id } });
await client.assets.get({ path: { space_id, asset_id } });

// Asset Folders
await client.assetFolders.getAll({ path: { space_id } });

// Components
await client.components.getAll({ path: { space_id } });
await client.components.create({ path: { space_id }, body: { component: { ... } } });
await client.components.delete_({ path: { space_id, component_id } });

// Component Folders
await client.componentFolders.getAll({ path: { space_id } });

// Datasources
await client.datasources.getAll({ path: { space_id } });
await client.datasources.create({ path: { space_id }, body: { datasource: { ... } } });

// Datasource Entries
await client.datasourceEntries.getAll({ path: { space_id, datasource_id } });
await client.datasourceEntries.update({ path: { space_id, datasource_entry_id }, body: { ... } });

// Spaces
await client.spaces.getAll({});
await client.spaces.get({ path: { space_id } });

// Presets
await client.presets.getAll({ path: { space_id } });

// Internal Tags
await client.internalTags.getAll({ path: { space_id } });

// Users
await client.users.getAll({ path: { space_id } });
```

> **Note**: `delete` is a reserved word in JavaScript. The generated SDK exposes it as `delete_`.

## Region Resolution

The client automatically determines the correct regional endpoint from the `region` option. You can also override it:

```typescript
// Custom base URL (bypasses automatic region detection)
const client = createManagementApiClient({
  accessToken: 'your-token',
  baseUrl: 'https://mapi.example.com',
});
```

## Rate Limiting

The client includes built-in preventive throttling. Instead of waiting for a 429 response, it limits the number of concurrent in-flight requests using a token-bucket before dispatching. By default it allows 6 concurrent requests and automatically adapts that limit from the `X-RateLimit-Policy` response header.

```typescript
const client = createManagementApiClient({
  accessToken: 'your-token',
  rateLimit: {
    maxConcurrent: 3,              // lower for stricter plans
    adaptToServerHeaders: false,   // disable dynamic adaptation
  },
  // Disable throttling entirely (not recommended):
  // rateLimit: false,
});
```

## Retry Logic

Retry is enabled by default for all HTTP methods on 429 responses, with exponential backoff:

```typescript
const client = createManagementApiClient({
  accessToken: 'your-token',
  retry: {
    limit: 12,              // max retry attempts
    backoffLimit: 20_000,   // max backoff delay in ms
    statusCodes: [429],     // only retry rate-limit responses
  },
});
```

## Error Handling

```typescript
import { ClientError, createManagementApiClient } from '@storyblok/management-api-client';

const client = createManagementApiClient({
  accessToken: 'your-token',
  throwOnError: true,
});

try {
  await client.stories.get({ path: { space_id: 123456, story_id: 99999 } });
} catch (error) {
  if (error instanceof ClientError) {
    console.error(error.status);     // e.g. 404
    console.error(error.statusText); // e.g. 'Not Found'
    console.error(error.data);       // parsed response body
  }
}
```

When `throwOnError` is `false` (the default), errors are returned in the response object instead of thrown:

```typescript
const result = await client.stories.get({
  path: { space_id: 123456, story_id: 99999 },
});

if (result.error) {
  console.error('Error:', result.error);
} else {
  console.log('Story:', result.data);
}
```

## TypeScript Support

Types are exported under namespaces to avoid name collisions:

```typescript
import type {
  StoriesTypes,
  DatasourcesTypes,
  ComponentsTypes,
} from '@storyblok/management-api-client';

const createStory = async (storyData: StoriesTypes.StoryCreateRequest) => {
  const response = await client.stories.create({
    path: { space_id: 123456 },
    body: storyData,
  });
  return response.data; // fully typed
};
```

Convenience top-level re-exports are also available:

```typescript
import type { Story, StoryCreateRequest, StoryUpdateRequest } from '@storyblok/management-api-client';
```

## Development

```bash
# Generate SDKs from OpenAPI specs
pnpm generate

# Build the package
pnpm build

# Run tests
pnpm test
```

## Contributing

This package is generated from OpenAPI specifications in `packages/openapi/`. To add new endpoints or modify existing ones, update the OpenAPI specs and regenerate the client.

---

## Migration Guide

This section covers all breaking changes from the class-based `ManagementApiClient` to the new `createManagementApiClient` factory function.

### Factory function (breaking)

```typescript
// Before
import { ManagementApiClient } from '@storyblok/management-api-client';
const client = new ManagementApiClient({ token: { accessToken: 'your-token' } });

// After
import { createManagementApiClient } from '@storyblok/management-api-client';
const client = createManagementApiClient({ accessToken: 'your-token' });
```

### Config shape (breaking)

```typescript
// Before
new ManagementApiClient({ token: { accessToken: '...' } });
new ManagementApiClient({ token: { oauthToken: '...' } });

// After
createManagementApiClient({ accessToken: '...' });
createManagementApiClient({ oauthToken: '...' });
```

### Renamed methods (breaking)

| Before | After |
|---|---|
| `client.stories.list(...)` | `client.stories.getAll(...)` |
| `client.stories.updateStory(...)` | `client.stories.update(...)` |
| `client.components.list(...)` | `client.components.getAll(...)` |
| `client.components.deleteComponent(...)` | `client.components.delete_(...)` |
| `client.datasources.list(...)` | `client.datasources.getAll(...)` |
| `client.datasourceEntries.list(...)` | `client.datasourceEntries.getAll(...)` |
| `client.datasourceEntries.updateDatasourceEntry(...)` | `client.datasourceEntries.update(...)` |
| `client.spaces.list(...)` | `client.spaces.getAll(...)` |
| `client.assets.list(...)` | `client.assets.getAll(...)` |
| `client.assetFolders.list(...)` | `client.assetFolders.getAll(...)` |
| `client.presets.list(...)` | `client.presets.getAll(...)` |
| `client.internalTags.list(...)` | `client.internalTags.getAll(...)` |
| `client.componentFolders.list(...)` | `client.componentFolders.getAll(...)` |

> **Note**: `delete` is a reserved JavaScript keyword. The method is now exposed as `delete_`.

### Removed runtime config mutation (breaking)

`client.setConfig()` and `client.setToken()` are removed — create a new client instance instead:

```typescript
// Before
client.setToken({ accessToken: 'new-token' });

// After
const newClient = createManagementApiClient({ accessToken: 'new-token' });
```

### Rate limiting (non-breaking, but note)

The client now includes built-in preventive throttling. If you were applying your own concurrency limiter (e.g. via a request interceptor with `async-sema`), remove it to avoid double-throttling and use the `rateLimit` option instead:

```typescript
// Before (manual limiter via request interceptor)
const sema = new RateLimit(3);
client.interceptors.request.use(async () => { await sema(); });

// After (built-in throttling)
const client = createManagementApiClient({
  accessToken: 'your-token',
  rateLimit: { maxConcurrent: 3 }, // default: 6
});
```

## License

MIT
