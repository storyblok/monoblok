# Storyblok Content Delivery API Client

<div align="center">
  <a href="https://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-capi-client" align="center">
    <img src="https://a.storyblok.com/f/88751/1776x360/4d075611c6/sb-js-sdk.png" alt="Storyblok Logo">
  </a>
  <h1 align="center">@storyblok/api-client</h1>
  <p align="center">
    A modern TypeScript client for the <a href="http://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-capi-client" target="_blank">Storyblok</a> Content Delivery API. Built with type safety and developer experience in mind.
  </p>
  <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/api-client">
    <img src="https://img.shields.io/npm/v/@storyblok/api-client/latest.svg?style=flat-square&color=8d60ff" alt="Storyblok Content API Client" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/api-client" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/api-client.svg?style=appveyor&color=8d60ff" alt="npm">
  </a>
  <a href="https://storyblok.com/join-discord">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a><br/>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-capi-client">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-8d60ff?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## Kickstart a new project

Are you eager to dive into coding? **[Follow these steps to kickstart a new project with Storyblok](https://www.storyblok.com/technologies?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-capi-client)**, and get started in just a few minutes!

## Installation

Install `@storyblok/api-client`:

```bash
npm install @storyblok/api-client
```

## How to use it

### Basic usage

```typescript
import { createApiClient } from '@storyblok/api-client';

// Initialize the client with your access token
const client = createApiClient({
  accessToken: 'YOUR_ACCESS_TOKEN',
});

// Fetch a single story
const result = await client.stories.get('home');

if (result.data) {
  console.log(result.data.story);
}

// Fetch multiple stories
const allStories = await client.stories.getAll({
  version: 'draft',
  starts_with: 'blog/',
});

if (allStories.data) {
  console.log(allStories.data.stories);
}
```

## Configuration

### Client options

```typescript
createApiClient({
  accessToken: 'YOUR_ACCESS_TOKEN', // required
  region: 'eu', // optional, default: 'eu'
  baseUrl: 'https://custom.com', // optional, overrides region
  headers: {}, // optional, custom headers
  throwOnError: false, // optional, default: false
});
```

### Region parameter

Possible values:

- `eu` (default): For spaces created in the EU
- `us`: For spaces created in the US
- `ap`: For spaces created in Australia
- `ca`: For spaces created in Canada
- `cn`: For spaces created in China

**Example for a space created in the US:**

```typescript
const client = createApiClient({
  accessToken: 'YOUR_ACCESS_TOKEN',
  region: 'us',
});
```

> **Note:** For spaces created in the United States or China, the `region` parameter **must** be specified.

### Custom base URL

If you need to use a custom base URL (e.g., for proxying requests), you can override the region-based URL:

```typescript
const client = createApiClient({
  accessToken: 'YOUR_ACCESS_TOKEN',
  baseUrl: 'https://your-custom-proxy.com',
});
```

## API Reference

### Fetching a single story

```typescript
client.stories.get(identifier, query = {});
```

**Parameters:**

- `identifier` (required): Story identifier - can be:
  - `full_slug` (string): e.g., `'blog/my-post'`
  - `id` (number): e.g., `123456`
  - `uuid` (string): e.g., `'abc-123'` (requires `find_by: 'uuid'` in query)
- `query` (optional): Query parameters object

**Example:**

```typescript
// Fetch by slug
const result = await client.stories.get('blog/my-first-post', {
  version: 'draft',
});

// Fetch by ID
const result = await client.stories.get(123456);

// Fetch by UUID
const result = await client.stories.get('abc-123-def', {
  find_by: 'uuid',
});

// With resolved relations
const result = await client.stories.get('blog/my-post', {
  version: 'draft',
  resolve_relations: 'article.author,article.categories',
});
```

### Fetching multiple stories

```typescript
client.stories.getAll(query = {});
```

**Parameters:**

- `query` (optional): Query parameters for filtering and pagination

**Examples:**

```typescript
// Get all published stories
const result = await client.stories.getAll({
  version: 'published',
});

// Filter by path
const result = await client.stories.getAll({
  starts_with: 'blog/',
  version: 'draft',
});

// Filter by content type
const result = await client.stories.getAll({
  filter_query: {
    component: {
      in: 'article,page',
    },
  },
});

// Pagination
const result = await client.stories.getAll({
  page: 1,
  per_page: 25,
});

// Search
const result = await client.stories.getAll({
  search_term: 'headless cms',
});
```

## Error handling

The client returns a response object with either `data` or `error`:

```typescript
const result = await client.stories.get('home');

if (result.data) {
  // Success - data is available
  console.log(result.data.story);
}
else {
  // Error occurred
  console.error(result.error);
}
```

### Using throwOnError

If you prefer exceptions over error objects, set `throwOnError: true`:

```typescript
const client = createApiClient({
  accessToken: 'YOUR_ACCESS_TOKEN',
  throwOnError: true,
});

try {
  const result = await client.stories.get('home');
  console.log(result.data.story);
}
catch (error) {
  console.error('Failed to fetch story:', error);
}
```

## TypeScript support

This client is written in TypeScript and provides full type safety:

```typescript
import type { Story } from '@storyblok/api-client';

const result = await client.stories.get('home');

if (result.data) {
  const story: Story = result.data.story;
  // All story properties are fully typed
  console.log(story.name);
  console.log(story.full_slug);
  console.log(story.content);
}
```

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

- [Discuss Storyblok on Github Discussions](https://github.com/storyblok/storyblok/discussions)

For community support, chatting with other users, please visit:

- [Discuss Storyblok on Discord](https://storyblok.com/join-discord)

## Support

For bugs or feature requests, please [submit an issue](https://github.com/storyblok/monoblok/issues/new/choose).

> [!IMPORTANT]
> Please search existing issues before submitting a new one. Issues without a minimal reproducible example will be closed. [Why reproductions are Required](https://antfu.me/posts/why-reproductions-are-required).

### I can't share my company project code

We understand that you might not be able to share your company's project code. Please provide a minimal reproducible example that demonstrates the issue by using tools like [Stackblitz](https://stackblitz.com) or a link to a Github Repo lease make sure you include a README file with the instructions to build and run the project, important not to include any access token, password or personal information of any kind.

### I only have a question

If you have a question, please ask in the [Discuss Storyblok on Discord](https://storyblok.com/join-discord) channel.

## Contributing

If you're interested in contributing to Storyblok CLI, please read our [contributing docs](https://github.com/storyblok/.github/blob/main/contributing.md) before submitting a pull request.

## License

[License](/LICENSE)
