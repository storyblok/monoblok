import { ISbConfig } from 'storyblok-js-client';
import { StoryblokFeature } from './components.feature';
import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { STORYBLOK_CONFIG, StoryblokService } from './storyblok.service';

/**
 * Provides Storyblok configuration at the application level.
 * Use this in your app.config.ts to initialize Storyblok.
 *
 * @param config - Storyblok configuration options
 * @param features - Optional features like `withStoryblokComponents()`
 * @returns EnvironmentProviders for Angular's DI system
 *
 * @example
 * ```typescript
 * import { provideStoryblok, withStoryblokComponents } from '@storyblok/angular';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideStoryblok(
 *       { accessToken: 'your-access-token', region: 'eu' },
 *       withStoryblokComponents({
 *         teaser: () => import('./components/teaser').then(m => m.Teaser),
 *         feature: () => import('./components/feature').then(m => m.Feature),
 *       })
 *     ),
 *   ],
 * };
 * ```
 */
export function provideStoryblok(
  config: ISbConfig,
  ...features: StoryblokFeature[]
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: STORYBLOK_CONFIG, useValue: config },
    provideAppInitializer(() => {
      const storyblok = inject(StoryblokService);
      storyblok.ɵinit(config);
    }),
    // Collect providers from all features
    ...features.flatMap((feature) => feature.ɵproviders),
  ]);
}
