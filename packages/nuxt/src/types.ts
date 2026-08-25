import type { ISbConfig } from "@storyblok/vue";

export interface PublicModuleOptions {
  enableSudoMode: boolean;
  usePlugin: boolean; // legacy opt. for enableSudoMode
  bridge: boolean; // storyblok bridge on/off
  devtools: boolean; // enable nuxt/devtools integration
  apiOptions: ISbConfig; // storyblok-js-client options
  componentsDir: string; // enable storyblok global directory for components
  enableServerClient: boolean; // keep accessToken server-side only
}

export interface AllModuleOptions extends PublicModuleOptions {
  accessToken: string;
}

declare module "@nuxt/schema" {
  interface NuxtConfig {
    storyblok?: Partial<AllModuleOptions>;
  }
  interface NuxtOptions {
    storyblok: AllModuleOptions;
  }
}
