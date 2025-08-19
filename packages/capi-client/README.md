# @storyblok/capi-client

A TypeScript client for the Storyblok Content Delivery API (CAPI) with full type safety and generated SDKs.

## Features

- 🚀 **Fully Generated**: Automatically generated from OpenAPI specifications
- 🔒 **Type Safe**: Full TypeScript support with generated types
- 🌍 **Multi-Region**: Support for all Storyblok regions (EU, US, CN, AP, CA)
- 🔧 **Flexible**: Configurable base URLs, headers, and error handling
- 📚 **Comprehensive**: Covers all CAPI endpoints (Stories, Spaces, Links, Datasources, Tags, Assets)

## Installation

```bash
npm install @storyblok/capi-client
# or
yarn add @storyblok/capi-client
# or
pnpm add @storyblok/capi-client
```

## Quick Start

```typescript
import { CapiClient } from '@storyblok/capi-client';

const client = new CapiClient({
  token: {
    token: 'your-public-or-preview-token'
  },
  region: 'eu' // Optional: defaults to 'eu'
});

// Get stories
const { data } = await client.stories.list({
  query: {
    version: 'published',
    starts_with: 'blog/',
    per_page: 10
  }
});

console.log(data?.stories);
```

## Configuration

### Token Types

CAPI supports two types of tokens:

- **Public Token**: Access to published content only
- **Preview Token**: Access to both draft and published content

```typescript
const client = new CapiClient({
  token: {
    token: 'your-token-here' // Public or preview token
  }
});
```

### Regions

Support for all Storyblok regions:

```typescript
const client = new CapiClient({
  token: { token: 'your-token' },
  region: 'eu' // 'eu' | 'us' | 'cn' | 'ap' | 'ca'
});
```

### Custom Configuration

```typescript
const client = new CapiClient({
  token: { token: 'your-token' },
  region: 'us',
  baseUrl: 'https://custom-api.example.com', // Override base URL
  headers: { 'Custom-Header': 'value' } // Additional headers
});
```

## Filter Queries

The client includes a simple utility for building filter queries that converts objects into the nested query parameter format expected by the Storyblok API.

### Basic Usage

```typescript
import { buildFilterQuery, IS } from '@storyblok/capi-client';

// Simple filter
const filter = buildFilterQuery({
  'content.category': { is: 'news' },
  'content.published': { is: IS.TRUE },
  'content.rating': { gt_int: 4 }
});

const { data } = await client.stories.list({
  query: { ...filter }
});
```

### Available Operations

- **Exact Match**: `{ is: value }` - Matches exact values or special values from `IS` enum
- **Array Inclusion**: `{ in: values[] }` - Matches any value in the specified array
- **Array Exclusion**: `{ not_in: values[] }` - Excludes values in the specified array
- **Pattern Matching**: `{ like: pattern }` - Matches patterns with wildcards (*)
- **Pattern Exclusion**: `{ not_like: pattern }` - Excludes patterns with wildcards
- **Array Element Match**: `{ any_in_array: values[] }` - Matches if any array element contains the specified values
- **All Array Elements**: `{ all_in_array: values[] }` - Matches if all specified values are in the array
- **Date Greater Than**: `{ gt_date: date }` - Date format: `YYYY-mm-dd HH:MM`
- **Date Less Than**: `{ lt_date: date }` - Date format: `YYYY-mm-dd HH:MM`
- **Integer Greater Than**: `{ gt_int: value }`
- **Integer Less Than**: `{ lt_int: value }`
- **Float Greater Than**: `{ gt_float: value }`
- **Float Less Than**: `{ lt_float: value }`

### "is" Operation Constants

For better type safety and readability, use the `IS` constants for common `is` operations:

- **Array Checks**: `IS.EMPTY_ARRAY`, `IS.NOT_EMPTY_ARRAY`
- **Field Existence**: `IS.EMPTY`, `IS.NOT_EMPTY` (also targets fields not in schema)
- **Boolean Checks**: `IS.TRUE`, `IS.FALSE`
- **Null Checks**: `IS.NULL`, `IS.NOT_NULL` (also targets fields not in schema)

```typescript
import { buildFilterQuery, IS } from '@storyblok/capi-client';

const filter = buildFilterQuery({
  'content.categories': { is: IS.EMPTY_ARRAY },        // No assigned categories
  'content.author': { is: IS.NOT_EMPTY_ARRAY },        // Has assigned author
  'content.highlighted': { is: IS.TRUE },              // Boolean field is true
  'content.scheduled': { is: IS.NOT_EMPTY }            // Has scheduled date
});
```

### Field Helpers

- **Internationalized Fields**: `i18nField(field, languageCode)` - Creates field keys for multilingual content
- **Nested Blok Fields**: `nestedField(field, index, property)` - Creates field keys for nested bloks
- **Nested Object Properties**: `nestedProperty(field, property)` - Creates field keys for nested object properties

### Internationalization Support

For multilingual content using Storyblok's Field-level Translation, use the `i18nField` helper:

```typescript
import { buildFilterQuery, i18nField, like, is } from '@storyblok/capi-client';

// Filter by German headline
const germanFilter = buildFilterQuery({
  [i18nField('headline', 'de')]: { like: 'Die Symphonie*' }
});

// Filter by Spanish (Colombia) headline
const spanishFilter = buildFilterQuery({
  [i18nField('headline', 'es-co')]: { 
    is: 'Sinfonía de la Tierra: Navegar por las maravillas y los desafíos de nuestro oasis azul' 
  }
});

// Use with language parameter
const { data } = await client.stories.list({
  query: {
    version: 'published',
    language: 'es-co', // Must match the language in the filter
    ...spanishFilter
  }
});
```

**Requirements for internationalized filters:**
- Space must be configured to publish languages independently
- Space must have `use_filter_query_in_translated_stories` enabled
- Request must include `version=published`
- Request must include `language` parameter matching the filter language

### Nested Fields and Bloks

For filtering nested content using dot notation, use the `nestedField` and `nestedProperty` helpers:

```typescript
import { buildFilterQuery, nestedField, nestedProperty, is, inArray } from '@storyblok/capi-client';

// Filter by nested blok field (first blok in body array)
const nestedBlokFilter = buildFilterQuery({
  [nestedField('body', 0, 'name')]: { is: 'This is a nested blok' }
});

// Filter by nested object property (SEO description)
const seoFilter = buildFilterQuery({
  [nestedProperty('seo', 'description')]: { is: 'not_empty' }
});

// Filter by nested blok with array operation
const nestedArrayFilter = buildFilterQuery({
  [nestedField('body', 1, 'tags')]: inArray(['featured', 'important'])
});

// Complex nested filter combining multiple conditions
const complexNestedFilter = buildFilterQuery({
  [nestedProperty('seo', 'title')]: { is: 'not_empty' },
  [nestedField('body', 0, 'component')]: { is: 'feature' },
  [nestedField('body', 0, 'highlighted')]: { is: 'true' }
});
```

**Generated parameters:**
```typescript
// Input
buildFilterQuery({
  [nestedField('body', 0, 'name')]: { is: 'This is a nested blok' }
})

// Output
{
  'filter_query[body.0.name][is]': 'This is a nested blok'
}
```

### Complex Examples

```typescript
// OR condition for multiple categories
const categoryFilter = buildFilterQuery(
  or([
    { 'content.category': { is: 'news' } },
    { 'content.category': { is: 'blog' } }
  ])
);

// Featured or high-rated content
const featuredFilter = buildFilterQuery(
  or([
    { 'content.tags': { any_in_array: ['featured'] } },
    { 'content.rating': { gt_int: 4 } }
  ])
);
```

## API Endpoints

### Stories

```typescript
// Get multiple stories
const { data } = await client.stories.list({
  query: {
    version: 'published',
    starts_with: 'blog/',
    per_page: 10,
    page: 1,
    ...buildFilterQuery({
      'content.category': { is: 'news' }
    })
  }
});

// Get a single story
const { data } = await client.stories.get({
  path: { identifier: 'home' }, // slug, ID, or UUID
  query: {
    version: 'published',
    resolve_links: 'story'
  }
});
```

### Spaces

```typescript
// Get current space information
const { data } = await client.spaces.get();
```

### Links

```typescript
// Get multiple links
const { data } = await client.links.list({
  query: {
    starts_with: 'blog/',
    include_dates: true,
    page: 1,
    per_page: 25
  }
});
```

### Datasources

```typescript
// Get multiple datasources
const { data } = await client.datasources.list({
  query: {
    page: 1,
    per_page: 25
  }
});

// Get a single datasource
const { data } = await client.datasources.get({
  path: { id: '123' }
});
```

### Datasource Entries

```typescript
// Get datasource entries
const { data } = await client.datasourceEntries.list({
  query: {
    datasource: 'categories',
    dimension: 'en',
    page: 1,
    per_page: 100
  }
});
```

### Tags

```typescript
// Get multiple tags
const { data } = await client.tags.list({
  query: {
    starts_with: 'blog/'
  }
});
```

### Assets

```typescript
// Get signed URL for private asset
const { data } = await client.assets.get({
  query: {
    filename: 'https://a.storyblok.com/f/123456/1920x1080/image.jpg'
  }
});
```

## Advanced Filtering

CAPI supports advanced filtering using the `filter_query` parameter:

```typescript
// Simple filtering
const filterQuery = {
  'content.category': { '$is': 'news' },
  'content.published': { '$is': true }
};

// Complex filtering with logical operators
const complexFilter = {
  '$and': [
    { 'content.category': { '$is': 'news' } },
    { 'content.publish_date': { '$gt_date': '2023-01-01' } },
    { 'content.publish_date': { '$lt_date': '2023-12-31' } }
  ]
};

const { data } = await client.stories.list({
  query: {
    filter_query: JSON.stringify(complexFilter)
  }
});
```

## Error Handling

```typescript
const client = new CapiClient({
  token: { token: 'your-token' },
  
});

try {
  const { data } = await client.stories.list();
} catch (error) {
  console.error('API Error:', error);
}
```

## Interceptors

Add request/response interceptors for logging, authentication, etc.:

```typescript
client.interceptors.request.use((request, options) => {
  console.log('Request:', request);
  return request;
});

client.interceptors.response.use((response) => {
  console.log('Response:', response);
  return response;
});
```

## Dynamic Configuration

Update client configuration at runtime:

```typescript
// Change region
client.setConfig({ region: 'us' });

// Change token
client.setToken({ token: 'new-token' });

// Add headers
client.setConfig({ 
  headers: { 'Custom-Header': 'value' } 
});
```

## TypeScript Support

Full TypeScript support with generated types:

```typescript
import type { Story, Space, Link } from '@storyblok/capi-client/types';

const { data } = await client.stories.list();
const stories: Story[] = data?.stories || [];
```

## Examples

See the [examples](./examples/) directory for complete usage examples.

## Development

### Building

```bash
pnpm build
```

### Generating SDKs

```bash
pnpm generate
```

### Testing

```bash
pnpm test
```

## License

MIT
