import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { environment } from '../environments/environment';
import {
  provideStoryblok,
  withStoryblokComponents,
  withLivePreview,
} from '@storyblok/angular';
import { storyblokComponents } from './storyblok.components';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(withEventReplay()),
    /** Set the correct region for your space. Learn more: https://storyblok-docs-platform-preview.netlify.app/docs/concepts/access-tokens */
    provideStoryblok(
      {
        accessToken: environment.accessToken,
        region: environment.region,
      },
      withStoryblokComponents(storyblokComponents),
      withLivePreview(),
    ),
  ],
};
