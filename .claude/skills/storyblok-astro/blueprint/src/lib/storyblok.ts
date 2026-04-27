import { createApiClient } from '@storyblok/api-client';

import type { Schema } from '../schema/schema';

export function createStoryblokClient() {
  const accessToken = import.meta.env.DEV
    ? import.meta.env.STORYBLOK_PREVIEW_TOKEN
    : import.meta.env.STORYBLOK_PUBLIC_TOKEN;

  if (!accessToken) {
    throw new Error(
      `Missing required env var: ${import.meta.env.DEV ? 'STORYBLOK_PREVIEW_TOKEN' : 'STORYBLOK_PUBLIC_TOKEN'}`,
    );
  }

  return createApiClient({
    accessToken,
    cache: {
      strategy: 'network-first',
    },
  }).withTypes<Schema>();
}
