import { Injectable, InjectionToken } from '@angular/core';
import StoryblokClient, {
  type ISbConfig,
  type ISbStoryData,
  type ISbStoriesParams,
} from 'storyblok-js-client';

/**
 * Injection token for Storyblok configuration
 */
export const STORYBLOK_CONFIG = new InjectionToken<ISbConfig>('STORYBLOK_CONFIG');

/**
 * Core service for interacting with the Storyblok API.
 * Provides methods for fetching stories and integrating with the Visual Editor.
 *
 * @example
 * ```typescript
 * export class MyComponent {
 *   private storyblok = inject(StoryblokService);
 *
 *   async loadContent() {
 *     const story = await this.storyblok.getStory('home');
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class StoryblokService {
  private storyblok: StoryblokClient | null = null;
  private initialized = false;

  /**
   * @internal
   * Initialize Storyblok SDK with the provided configuration.
   * This is called automatically by `provideStoryblok()`.
   */
  /** @internal */
  ɵinit(config: ISbConfig): void {
    if (this.initialized) {
      return;
    }
    const storyblok = new StoryblokClient(config);
    this.storyblok = storyblok;
    this.initialized = true;
  }

  /**
   * Fetch a single story by its slug.
   *
   * @param slug - The story slug (e.g., 'home', 'about', 'blog/my-post')
   * @param options - API options for resolving relations and links
   * @returns The story data or null if not found
   */
  async getStory(slug: string, options: ISbStoriesParams = {}): Promise<ISbStoryData | null> {
    if (!this.storyblok) {
      console.error('Storyblok API not initialized. Call init() first.');
      return null;
    }
    try {
      const response = await this.storyblok.get(`cdn/stories/${slug}`, {
        version: options.version ?? 'draft',
        resolve_relations: options.resolve_relations,
        resolve_links: options.resolve_links,
      });

      return response.data?.story ?? null;
    } catch (error) {
      console.error(`Failed to fetch story: ${slug}`, error);
      return null;
    }
  }
}
