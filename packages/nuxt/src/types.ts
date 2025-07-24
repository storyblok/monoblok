export interface PublicModuleOptions {
  enableSudoMode: boolean;
  usePlugin: boolean; // legacy opt. for enableSudoMode
  bridge: boolean; // storyblok bridge on/off
  devtools: boolean; // enable nuxt/devtools integration
  apiOptions: any; // storyblok-js-client options
  componentsDir: string; // enable storyblok global directory for components
  enableServerClient: boolean; // keep accessToken server-side only
}

export interface AllModuleOptions extends PublicModuleOptions {
  accessToken: string;
}
