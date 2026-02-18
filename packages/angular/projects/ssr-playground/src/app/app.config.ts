import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { greetings, provideStoryblok, withStoryblokComponents } from '@storyblok/angular';
import { storyblokComponents } from './storyblok.components';
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideStoryblok(
      {
        accessToken: 'nVjy7VdMK6ObZxyDfTWNwgtt',
      },
      withStoryblokComponents(storyblokComponents),
    ),
  ],
};
greetings('SSR Playground');
