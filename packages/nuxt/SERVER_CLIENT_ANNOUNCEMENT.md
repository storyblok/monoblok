# Server-Side Client Support in Nuxt SDK 8.2.0

We're excited to announce that starting with version `8.2.0`, the [@storyblok/nuxt](https://www.npmjs.com/package/@storyblok/nuxt) SDK introduces **server-side client support**. This new feature allows you to keep your Storyblok access token secure on the server while still leveraging the full power of live preview and real-time editing capabilities.

## Why Server-Side Client?

Previously, the Storyblok access token was always exposed to the client-side. This created two main challenges:

1. **All-or-nothing approach** - If you wanted to keep your access token server-side, you had to completely opt-out from using the Nuxt SDK
2. **Enterprise concerns** - While the token is read-only and rate-limited, some organizations require strict compliance policies that mandate server-side-only tokens

With the new `enableServerClient` option, you can now:

- **Keep tokens secure** - Access tokens stay exclusively server-side, never exposed to the client bundle
- **Use full SDK capabilities** - Continue using all SDK features for rendering components, setting up live preview, and more
- **Leverage Nitro's power** - Create custom API routes to fetch content, add caching, combine data from multiple sources, or implement any server-side logic
- **Reduce bundle size** - The Storyblok client code stays on the server, making your client-side bundle smaller

## Two approaches

### Approach 1: Traditional Client-Side Fetching (Default)

The traditional approach keeps everything simple - your access token is included in the public runtime config, and you can fetch content directly from your components using composables.

**Configuration:**

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@storyblok/nuxt'],

  storyblok: {
    accessToken: 'YOUR_ACCESS_TOKEN',
  },
});
```

**Usage in Pages:**

```vue
<script setup lang="ts">
// Fetch content directly from the component
const { story, error } = await useAsyncStoryblok('home', {
  api: {
    version: 'draft'
  }
});
</script>

<template>
  <div>
    <StoryblokComponent v-if="story" :blok="story.content" />
  </div>
</template>
```

### Approach 2: Server-Side Client (New in 8.2.0)

The new server-side approach keeps your access token exclusively on the server. You create Nitro API routes to fetch content, and your components consume these routes instead of calling Storyblok directly.

**Configuration:**

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@storyblok/nuxt'],

  storyblok: {
    accessToken: 'YOUR_ACCESS_TOKEN',
    enableServerClient: true, // 🔒 Keep token server-side
  },
});
```

**Create your Nitro API route:**

```ts
import { serverStoryblokClient } from '#storyblok/server';

export default defineEventHandler(async (event) => {
  // Get the Storyblok client instance with server-side access token
  const storyblokApi = serverStoryblokClient(event);

  try {
    const { data } = await storyblokApi.get('cdn/stories/home', {
      version: 'draft',
    });

    return {
      success: true,
      story: data.story,
    };
  }
  catch (error) {
    return {
      success: false,
      error,
    };
  }
});
```

**Usage in Pages:**

```vue
<script setup lang="ts">
// Fetch from your API route
const { data, pending, error } = await useFetch('/api/test');

// Setup the bridge to enable Live Edit
onMounted(() => {
  if (data.value?.story) {
    useStoryblokBridge(data.value.story.id, (newStory: any) => {
      data.value.story = newStory;
    });
  }
});
</script>

<template>
  <div>
    <div v-if="pending">Loading...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <div v-else>
      <StoryblokComponent v-if="data.story" :blok="data.story.content" />
    </div>
  </div>
</template>
```

## Comparison: When to Use Each Approach

| Feature | Client-Side (Default) | Server-Side (New) |
|---------|----------------------|-------------------|
| **Token Location** | Public runtime config (exposed to client) | Private runtime config (server-only) |
| **Data Fetching** | `useAsyncStoryblok()` | `useFetch('/api/...')` to your API routes |
| **API Routes Required** | No | Yes - create `server/api/` endpoints |
| **Live Preview** | Auto-enabled with `useAsyncStoryblok()` | Manual setup with `useStoryblokBridge()` |
| **Bundle Size** | Includes Storyblok client | Smaller - client code stays on server |
| **Use Case** | Standard security requirements, rapid development | Enterprise security policies, custom server logic |
| **Complexity** | Simple - direct API calls to Storyblok | Moderate - requires API route layer |

## Migration Guide

If you're migrating an existing application to use server-side client:

1. Add `enableServerClient: true` to your `nuxt.config.ts`
2. Create server API routes using `serverStoryblokClient()`
3. Replace `useAsyncStoryblok()` calls with `useFetch()` to your API routes
4. Add `useStoryblokBridge()` in `onMounted()` for live preview

**Important:** With `enableServerClient: true`:
- ❌ Don't use `useStoryblokApi()` or `useAsyncStoryblok()` in components
- ✅ Do use `useFetch()` to call your server API routes
- ✅ Do use `useStoryblokBridge()` for live preview

## Resources

| Resource | Link |
|----------|------|
| GitHub Repository | https://github.com/storyblok/monoblok |
| NPM Package | https://npmjs.com/package/@storyblok/nuxt |
| Nuxt Guide | https://www.storyblok.com/docs/guides/nuxt/ |
| Nitro Documentation | https://nitro.unjs.io/ |
