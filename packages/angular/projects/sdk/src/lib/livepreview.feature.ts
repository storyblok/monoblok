import type { BridgeParams } from '@storyblok/preview-bridge';
import { StoryblokFeature } from './components.feature';
import { Provider } from '@angular/core';
import { LIVE_PREVIEW_CONFIG, LIVE_PREVIEW_ENABLED } from './livepreview.service';

/**
 * Enables Storyblok Live Preview support.
 *
 * This feature is optional and tree-shakeable.
 * The Storyblok bridge code is loaded only when
 * `LivePreviewService.listen()` is called.
 *
 * @param config Optional Storyblok bridge configuration
 */
export function withLivePreview(config?: BridgeParams): StoryblokFeature {
  // Only provide the tokens - the service is providedIn: 'root'
  // This enables the feature and passes configuration
  const providers: Provider[] = [
    { provide: LIVE_PREVIEW_ENABLED, useValue: true },
    { provide: LIVE_PREVIEW_CONFIG, useValue: config ?? {} },
  ];

  return {
    ɵkind: 'livePreview',
    ɵproviders: providers,
  };
}
