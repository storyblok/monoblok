import { createApiClient } from '@storyblok/api-client';

import type { Schema } from '../schema/schema';

/**
 * Type-safe Storyblok Content Delivery API client.
 * Schema is applied for compile-time type narrowing of story content.
 *
 * Token is read from STORYBLOK_PREVIEW_TOKEN via process.env (server-side only).
 * Not prefixed with VITE_ intentionally — this token must never be exposed to the client bundle.
 */
export function createStoryblokClient() {
  const accessToken = process.env.STORYBLOK_PREVIEW_TOKEN;

  if (!accessToken) {
    throw new Error('Missing required env var: STORYBLOK_PREVIEW_TOKEN');
  }

  return createApiClient({
    accessToken,
    cache: {
      strategy: 'network-first',
    },
  }).withTypes<Schema>();
}
