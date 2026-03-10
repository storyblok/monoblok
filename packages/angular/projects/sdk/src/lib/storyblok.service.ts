import { Injectable, InjectionToken } from '@angular/core';
import type { ContentApiClientConfig } from '@storyblok/api-client';
import { createApiClient } from '@storyblok/api-client';

export type StoryblokClientConfig = ContentApiClientConfig<boolean, boolean>;
export const STORYBLOK_CONFIG = new InjectionToken<StoryblokClientConfig>('STORYBLOK_CONFIG');
type StoryblokClient = ReturnType<typeof createApiClient>;
@Injectable({
  providedIn: 'root',
})
export class StoryblokService {
  private client: StoryblokClient | null = null;
  private initialized = false;

  /**
   * Initialize Storyblok API client with config
   */
  ɵinit(config: StoryblokClientConfig): void {
    if (this.initialized) return;
    this.client = createApiClient(config);
    this.initialized = true;
  }

  /**
   * Get the initialized API client instance
   */
  getClient(): StoryblokClient {
    if (!this.client) {
      throw new Error(
        'Storyblok API client not initialized. Did you forget to call provideStoryblok()?',
      );
    }
    return this.client;
  }
}
