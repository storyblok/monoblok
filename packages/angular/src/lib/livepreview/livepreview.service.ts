import { InjectionToken, inject, NgZone, Injectable, DestroyRef } from "@angular/core";
import { Story } from "@storyblok/api-client";
import {
  type BridgeParams,
  type LivePreviewOptions,
  onStoryblokEditorEvent,
} from "@storyblok/live-preview";

/**
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
 * Options for {@link LivePreviewService.listen}: the Preview Bridge
 * configuration, `onChange` and `onError` handlers, and an optional
 * `DestroyRef` that removes the subscription automatically.
 */
export type LivePreviewListenOptions = LivePreviewOptions & {
  /**
   * Removes the subscription when this `DestroyRef` fires, for example the
   * calling component's. If it has already been destroyed, nothing is
   * subscribed.
   */
  destroyRef?: DestroyRef;
};

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
   * Pass the calling component's `DestroyRef` as `options.destroyRef` to
   * remove the subscription automatically when the component is destroyed.
   * Otherwise, call the returned cleanup function yourself. The shared bridge
   * is destroyed when the last subscription using it is removed.
   *
   * When the story is saved or published, the page reloads. To handle it
   * yourself instead, pass the optional `options.onChange`. Preview Bridge
   * load failures are logged with `console.error`, or passed to the optional
   * `options.onError`. Both run inside the Angular zone, like `callback`.
   *
   * @example
   * ```ts
   * private readonly destroyRef = inject(DestroyRef);
   *
   * ngOnInit(): void {
   *   void this.livePreview.listen((story) => this.story.set(story), {
   *     destroyRef: this.destroyRef,
   *   });
   * }
   * ```
   *
   * @param callback Called with the updated story on every `input` event.
   * @param options Optional bridge configuration, merged over the base config,
   * plus `onChange`, `onError`, and `destroyRef`.
   * @returns A promise that resolves to a cleanup function.
   */
  async listen(
    callback: LivePreviewCallback,
    options?: LivePreviewListenOptions,
  ): Promise<() => void> {
    return this.subscribe(callback, options);
  }

  /**
   * Subscribes to Storyblok Visual Editor live preview updates and
   * automatically removes the subscription when the provided `DestroyRef` fires.
   *
   * @deprecated Use `listen(callback, { ...options, destroyRef })` instead.
   *
   * @param callback Called with the updated story on every `input` event.
   * @param destroyRef The `DestroyRef` of the calling component or service.
   * @param options Optional bridge configuration; merged over the base config.
   * @returns A promise resolving to the subscription cleanup function. Never
   * rejects: failures are logged and resolve to a no-op cleanup.
   */
  async connect(
    callback: LivePreviewCallback,
    destroyRef: DestroyRef,
    options?: BridgeParams,
  ): Promise<() => void> {
    try {
      return this.subscribe(callback, { ...options, destroyRef });
    } catch (error) {
      console.error("[Storyblok] connect() failed to subscribe to live preview updates:", error);
      return () => {};
    }
  }

  /**
   * Registers the subscription and returns its cleanup function synchronously,
   * so it can be tied to a `DestroyRef` without awaiting the bridge.
   */
  private subscribe(callback: LivePreviewCallback, options?: LivePreviewListenOptions): () => void {
    // Check before touching the DestroyRef, so a missing withLivePreview() is
    // reported in dev mode even when the DestroyRef is already destroyed.
    if (!this.enabledFlag) {
      if (typeof ngDevMode === "undefined" || ngDevMode) {
        throw new LivePreviewNotEnabledError();
      }
      return () => {};
    }

    const { destroyRef, onChange, onError, ...bridgeOptions } = options ?? {};
    let cleanup: (() => void) | undefined;

    // During SSR, Angular may have already destroyed the view by the time
    // ngOnInit runs (e.g. on navigation), causing DestroyRef.onDestroy() to
    // throw NG0911. The context is gone, so don't touch the shared bridge.
    let unregister: (() => void) | undefined;
    if (destroyRef) {
      try {
        unregister = destroyRef.onDestroy(() => cleanup?.());
      } catch {
        return () => {};
      }
    }

    // onStoryblokEditorEvent never throws: failures go to onError.
    cleanup = this.subscribeToEditor(callback, bridgeOptions, onChange, onError);

    return () => {
      unregister?.();
      cleanup?.();
    };
  }

  private subscribeToEditor(
    callback: LivePreviewCallback,
    bridgeOptions: BridgeParams,
    onChange: LivePreviewOptions["onChange"],
    onError: LivePreviewOptions["onError"],
  ): () => void {
    const config: LivePreviewOptions = { ...this.baseConfig, ...bridgeOptions };
    // Only pass handlers that were given: without `onChange` the page reloads,
    // and without `onError` the failure is logged.
    if (onChange) config.onChange = (event) => this.ngZone.run(() => onChange(event));
    if (onError) config.onError = (error) => this.ngZone.run(() => onError(error));

    return onStoryblokEditorEvent((story) => {
      this.ngZone.run(() => {
        callback(story as Story);
      });
    }, config);
  }
}
