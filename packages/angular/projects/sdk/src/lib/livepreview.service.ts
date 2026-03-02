import { InjectionToken, Provider, inject, NgZone, PLATFORM_ID, Injectable } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { ISbStoryData } from '@storyblok/js';
import type StoryblokBridge from '@storyblok/preview-bridge';
import { BridgeParams } from '@storyblok/preview-bridge';

/**
 * Internal injection token holding the Storyblok bridge configuration.
 * Provided by `withLivePreview()`.
 *
 * @internal
 */
export const LIVE_PREVIEW_CONFIG = new InjectionToken<BridgeParams>('LIVE_PREVIEW_CONFIG');

/**
 * Injection token indicating whether live preview is enabled.
 * This is set to `true` by `withLivePreview()`.
 */
export const LIVE_PREVIEW_ENABLED = new InjectionToken<boolean>('LIVE_PREVIEW_ENABLED');

/**
 * Callback function type for live preview updates.
 */
export type LivePreviewCallback = (story: ISbStoryData) => void;

/**
 * Error thrown in development when LivePreviewService is used
 * without enabling the feature via `withLivePreview()`.
 */
export class LivePreviewNotEnabledError extends Error {
  constructor() {
    super(
      `[angular-storyblok] LivePreviewService requires withLivePreview() to be added to your providers.\n\n` +
        `Add it to your app.config.ts:\n\n` +
        `  provideStoryblok(\n` +
        `    { accessToken: 'your-token' },\n` +
        `    withStoryblokComponents({ ... }),\n` +
        `    withLivePreview()  // <-- Add this\n` +
        `  )\n`,
    );
    this.name = 'LivePreviewNotEnabledError';
  }
}
/**
 * Service responsible for connecting Angular applications
 * to the Storyblok Visual Editor (Live Preview).
 *
 * This service is tree-shakeable and only becomes active when
 * `withLivePreview()` is added to the providers.
 */
@Injectable({
  providedIn: 'root',
})
export class LivePreviewService {
  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly enabledFlag = inject(LIVE_PREVIEW_ENABLED, { optional: true }) ?? false;

  private readonly baseConfig = inject(LIVE_PREVIEW_CONFIG, { optional: true }) ?? {};

  private bridge: StoryblokBridge | null = null;
  private bridgePromise: Promise<StoryblokBridge> | null = null;

  /**
   * Check if running in browser environment.
   */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /**
   * Indicates whether live preview was enabled via `withLivePreview()`.
   */
  get enabled(): boolean {
    return this.enabledFlag;
  }

  /**
   * Lazily loads and creates the Storyblok bridge instance.
   * This ensures the bridge code is only loaded in the browser
   * and only when actually needed.
   */
  private async createBridge(config: BridgeParams): Promise<StoryblokBridge> {
    if (this.bridge) {
      return this.bridge;
    }

    const { default: StoryblokBridgeClass } = await import('@storyblok/preview-bridge');

    this.bridge = new StoryblokBridgeClass(config);
    return this.bridge;
  }

  /**
   * Starts listening to Storyblok Visual Editor events.
   *
   * - `input`: Emits updated story data (no reload)
   * - `change` / `published`: Reloads the page
   *
   * In development, calling this without `withLivePreview()` will throw
   * a helpful error. In production, it silently does nothing.
   *
   * @param callback Function invoked with updated story data
   * @param options Optional bridge configuration overrides
   */

  async listen(callback: LivePreviewCallback, options?: BridgeParams): Promise<void> {
    // Skip on server-side rendering - live preview only works in browser
    if (!this.isBrowser) {
      return;
    }

    // Check if feature is enabled
    if (!this.enabledFlag) {
      // In development, throw a helpful error
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        throw new LivePreviewNotEnabledError();
      }
      // In production, silently no-op (don't crash the app)
      return;
    }

    // Merge config with options if provided
    const mergedConfig: BridgeParams = {
      ...(this.baseConfig ?? {}),
      ...(options ?? {}),
    };

    const bridge = await this.createBridge(mergedConfig);

    bridge.on(['published', 'change', 'input'], (event) => {
      if (event.action === 'input') {
        // Run callback in NgZone for proper change detection
        this.ngZone.run(() => callback(event.story as unknown as ISbStoryData));
      } else if (event.action === 'published' || event.action === 'change') {
        window.location.reload();
      }
    });
  }
}
