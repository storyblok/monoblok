# @storyblok/mapi-client

A comprehensive TypeScript SDK for the Storyblok Management API with automatic rate limiting, 429 retry handling, and intelligent region resolution.

## Features

- ** Type-Safe**: Generated from OpenAPI specifications with full TypeScript support
- ** Rate Limiting**: Built-in concurrency control and 429 retry handling  
- ** Region Resolution**: Automatic regional endpoint selection based on space ID
- ** Retry Logic**: Intelligent retry with exponential backoff and `retry-after` header support
- ** Multi-Resource**: Unified client for many MAPI resources (stories, datasources, components, etc.)

## Installation

```bash
npm install @storyblok/mapi-client
# or
pnpm add @storyblok/mapi-client
```

## Quick Start

```typescript
import { MapiClient } from '@storyblok/mapi-client';

const client = new MapiClient({
  token: { accessToken: 'your-personal-access-token' },
  // Optional configuration
  region: 'us', // 'eu' | 'us' | 'ap' | 'ca' | 'cn'
  rateLimiting: {
    maxConcurrent: 5,
    retryDelay: 1000,
    maxRetries: 3
  }
});

// Get stories with full type safety
const stories = await client.stories.list({
  path: { space_id: 123456 },
  query: { per_page: 10 }
});

// Create a datasource
const datasource = await client.datasources.create({
  path: { space_id: 123456 },
  body: {
    datasource: {
      name: 'My Datasource',
      slug: 'my-datasource'
    }
  }
});
```

## Authentication

### Personal Access Token
```typescript
const client = new MapiClient({
  token: { accessToken: 'your-personal-access-token' }
});
```

### OAuth Token
```typescript
const client = new MapiClient({
  token: { oauthToken: 'your-oauth-token' }
});
```

## Configuration

```typescript
interface MapiClientConfig {
  token: { accessToken: string } | { oauthToken: string };
  region?: 'eu' | 'us' | 'ap' | 'ca' | 'cn'; // Auto-detected from space_id if not provided
  baseUrl?: string; // Override automatic region resolution
  headers?: Record<string, string>; // Additional headers
  throwOnError?: boolean; // Throw on HTTP errors (default: false)
  rateLimiting?: {
    maxConcurrent?: number; // Max concurrent requests (default: 5)
    retryDelay?: number; // Retry delay in ms (default: 1000)
    maxRetries?: number; // Max retry attempts (default: 3)
  };
}
```

## Available Resources

The client provides access to all Storyblok Management API resources:

```typescript
// Stories
await client.stories.list({ path: { space_id } });
await client.stories.get({ path: { space_id, story_id } });
await client.stories.create({ path: { space_id }, body: { story: {...} } });
await client.stories.updateStory({ path: { space_id, story_id }, body: { story: {...} } });
await client.stories.delete({ path: { space_id, story_id } });

// Datasources
await client.datasources.list({ path: { space_id } });
await client.datasources.create({ path: { space_id }, body: { datasource: {...} } });

// Components
await client.components.list({ path: { space_id } });
await client.components.create({ path: { space_id }, body: { component: {...} } });

// Spaces
await client.spaces.list({});
await client.spaces.get({ path: { space_id } });

// Datasource Entries
await client.datasourceEntries.list({ path: { space_id, datasource_id } });

// Internal Tags
await client.internalTags.list({ path: { space_id } });
```

## Region Resolution

The client automatically determines the correct regional endpoint based on your space ID:

```typescript
// These will automatically route to the correct regional endpoints:
await client.stories.list({ path: { space_id: 564469716905585 } }); 
// → https://api-us.storyblok.com

await client.stories.list({ path: { space_id: 845944693616241 } }); 
// → https://api-ca.storyblok.com

await client.stories.list({ path: { space_id: 1127419670326897 } }); 
// → https://api-ap.storyblok.com
```

### Override Region Resolution
```typescript
const client = new MapiClient({
  token: { accessToken: 'your-token' },
  baseUrl: 'https://custom-api.example.com' // Bypasses automatic region detection
});
```

## Rate Limiting & Retry Logic

The client includes intelligent rate limiting and retry handling:

- **Concurrent Request Limiting**: Controls how many requests run simultaneously
- **429 Retry Handling**: Automatically retries on rate limit responses
- **Retry-After Support**: Respects `retry-after` headers from the API
- **Exponential Backoff**: Smart retry delays to avoid overwhelming the API

```typescript
const client = new MapiClient({
  token: { accessToken: 'your-token' },
  rateLimiting: {
    maxConcurrent: 3,    // Max 3 concurrent requests
    retryDelay: 2000,    // 2 second default retry delay
    maxRetries: 5        // Retry up to 5 times on 429
  }
});

// These will be automatically queued and retried if needed
const promises = Array.from({ length: 10 }, (_, i) =>
  client.stories.list({ path: { space_id: 123456 }, query: { page: i + 1 } })
);

const results = await Promise.all(promises);
```

## Runtime Configuration

Update client configuration at runtime:

```typescript
// Update region/baseUrl
client.setConfig({ 
  region: 'us',
  headers: { 'Custom-Header': 'value' }
});

// Update authentication
client.setToken({ accessToken: 'new-token' });

// Update rate limiting
client.setRateLimitConfig({ 
  maxConcurrent: 10,
  retryDelay: 500
});

// Get rate limiting stats
const stats = client.getRateLimitStats();
console.log(`Queue: ${stats.queueLength}, Running: ${stats.running}`);
```

## Error Handling

```typescript
try {
  const story = await client.stories.get({
    path: { space_id: 123456, story_id: 'non-existent' }
  });
} catch (error) {
  if (error.status === 404) {
    console.log('Story not found');
  }
}

// Or configure to not throw errors
const client = new MapiClient({
  token: { accessToken: 'your-token' },
  throwOnError: false
});

const result = await client.stories.get({
  path: { space_id: 123456, story_id: 'non-existent' }
});

if (result.error) {
  console.log('Error:', result.error);
} else {
  console.log('Story:', result.data);
}
```

## TypeScript Support

The client provides full TypeScript support with generated types:

```typescript
import type { 
  StoriesTypes,
  DatasourcesTypes,
  ComponentsTypes 
} from '@storyblok/mapi-client';

// Full type safety for request/response data
const createStory = async (storyData: StoriesTypes.CreateRequestBody) => {
  const response = await client.stories.create({
    path: { space_id: 123456 },
    body: storyData
  });
  
  // Response is fully typed
  return response.data; // StoriesTypes.Story
};
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

## License
MIT
