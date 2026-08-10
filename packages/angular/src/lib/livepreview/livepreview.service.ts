import { InjectionToken, inject, NgZone, Injectable } from "@angular/core";
import { Story } from "@storyblok/api-client";
import { type BridgeParams, onStoryblokEditorEvent } from "@storyblok/live-preview";

/**å
 * Internal injection token holding the Storyblok bridge configuration.
 * Provided by `withLivePreview()`.
 *
 * @internal
 */
export const LIVE_PREVIEW_CONFIG = new InjectionToken<BridgeParams>("LIVE_PREVIEW_CONFIG");

/**
 * Injection token indicating whether live preview is enabled.
 * This is set to `true` by `withLivePreview()`.
 */
export const LIVE_PREVIEW_ENABLED = new InjectionToken<boolean>("LIVE_PREVIEW_ENABLED");

/**
 * Callback function type for live preview updates.
 */
export type LivePreviewCallback = (story: Story) => void;

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
    this.name = "LivePreviewNotEnabledError";
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
  providedIn: "root",
})
export class LivePreviewService {
  private readonly ngZone = inject(NgZone);

  private readonly enabledFlag = inject(LIVE_PREVIEW_ENABLED, { optional: true }) ?? false;

  private readonly baseConfig = inject(LIVE_PREVIEW_CONFIG, { optional: true }) ?? {};

  async listen(callback: LivePreviewCallback, options?: BridgeParams): Promise<() => void> {
    if (!this.enabledFlag) {
      if (typeof ngDevMode === "undefined" || ngDevMode) {
        throw new LivePreviewNotEnabledError();
      }
      return () => {};
    }

    const mergedConfig: BridgeParams = {
      ...this.baseConfig,
      ...options,
    };

    return onStoryblokEditorEvent((story) => {
      this.ngZone.run(() => {
        callback(story as Story);
      });
    }, mergedConfig);
  }
}
