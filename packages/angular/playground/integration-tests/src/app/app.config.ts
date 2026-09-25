import { provideClientHydration, withEventReplay } from "@angular/platform-browser";
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from "@angular/core";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import {
  provideStoryblok,
  type StoryblokClientConfig,
  withLivePreview,
  withStoryblokComponents,
  withStoryblokRichtextComponents,
} from "@storyblok/angular";
import { routes } from "./app.routes";
import { storyblokComponents, storyblokRichtextComponents } from "./storyblok.components";

type RuntimeWithProcess = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
  __STORYBLOK_RUNTIME_CONFIG__?: { accessToken?: string };
};

const runtime = globalThis as RuntimeWithProcess;
// Falls back to the same public demo token `playground/ssr` uses, so a build
// or type-check run without `.env.qa-engineer-manual` sourced (e.g. in CI)
// still succeeds. QA runs always source the real token, which takes priority.
const accessToken =
  runtime.__STORYBLOK_RUNTIME_CONFIG__?.accessToken ??
  runtime.process?.env?.["STORYBLOK_PREVIEW_TOKEN"] ??
  "OurklwV5XsDJTIE1NJaD2wtt";

const sbConfig: StoryblokClientConfig = {
  accessToken,
  region: "eu",
  inlineRelations: true,
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(withEventReplay()),
    provideStoryblok(
      sbConfig,
      withStoryblokComponents(storyblokComponents),
      withLivePreview({ resolveRelations: ["article.author"] }),
      withStoryblokRichtextComponents(storyblokRichtextComponents),
    ),
  ],
};
