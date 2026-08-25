import { InjectionToken, inject, NgZone, Injectable, DestroyRef } from "@angular/core";
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

  /**
   * Subscribes to Storyblok Visual Editor live preview updates.
   *
   * Returns a cleanup function that destroys the bridge when called.
   * For automatic cleanup tied to a component or service lifetime, prefer
   * {@link connect} which accepts a `DestroyRef` and handles teardown for you.
   *
   * @param callback Called with the updated story on every `input` event.
   * @param options Optional bridge configuration; merged over the base config.
   * @returns A promise that resolves to a cleanup function.
   */
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

  /**
   * Subscribes to Storyblok Visual Editor live preview updates and
   * automatically destroys the bridge when the provided `DestroyRef` fires.
   *
   * This is the preferred API for component use. It eliminates the need for
   * a manual cleanup field and an `ngOnDestroy` implementation, and correctly
   * handles the case where the component is destroyed while the bridge is
   * still loading.
   *
   * @example
   * ```ts
   * private readonly destroyRef = inject(DestroyRef);
   *
   * ngOnInit(): void {
   *   this.livePreview.connect(
   *     (story) => this.story.set(story),
   *     this.destroyRef,
   *     this.bridgeConfig,
   *   );
   * }
   * ```
   *
   * @param callback Called with the updated story on every `input` event.
   * @param destroyRef The `DestroyRef` of the calling component or service.
   * @param options Optional bridge configuration; merged over the base config.
   */
  connect(callback: LivePreviewCallback, destroyRef: DestroyRef, options?: BridgeParams): void {
    let cleanup: (() => void) | undefined;
    let destroyed = false;

    // Register teardown synchronously — before the async bridge load — so
    // that if the component is destroyed while the bridge is still loading,
    // `destroyed` is set to true and the bridge is torn down as soon as the
    // promise resolves.
    //
    // Guard with try/catch: during SSR, Angular may have already destroyed
    // the view by the time ngOnInit runs (e.g. on navigation), causing
    // DestroyRef.onDestroy() to throw NG0911. In that case treat the context
    // as already destroyed so the bridge is torn down immediately once loaded.
    try {
      destroyRef.onDestroy(() => {
        destroyed = true;
        cleanup?.();
      });
    } catch {
      destroyed = true;
    }

    this.listen(callback, options)
      .then((fn) => {
        cleanup = fn;
        if (destroyed) {
          fn();
        }
      })
      .catch((err: unknown) => {
        console.error("[Storyblok] connect() failed to subscribe to live preview updates:", err);
      });
  }
}
