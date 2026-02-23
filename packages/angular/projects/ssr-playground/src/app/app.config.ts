import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import {
  provideStoryblok,
  withLivePreview,
  withStoryblokComponents,
  type ISbConfig,
} from '@storyblok/angular';
import { storyblokComponents } from './storyblok.components';

const sbConfig: ISbConfig = {
  accessToken: 'nVjy7VdMK6ObZxyDfTWNwgtt',
  region: 'eu',
};
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(withEventReplay()),
    provideStoryblok(
      sbConfig,
      withStoryblokComponents(storyblokComponents),
      withLivePreview({
        resolveRelations: ['feature_posts.posts'],
      }),
    ),
  ],
};
