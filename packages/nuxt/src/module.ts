import {
  addComponentsDir,
  addImports,
  addImportsDir,
  addPlugin,
  createResolver,
  defineNuxtModule,
} from '@nuxt/kit';
import type { NuxtHookName } from '@nuxt/schema';
import type { Nuxt } from 'nuxt/schema';
import type { AllModuleOptions, PublicModuleOptions } from './types';

export * from './types';

export default defineNuxtModule<AllModuleOptions>({
  meta: {
    name: '@storyblok/nuxt',
    configKey: 'storyblok',
  },
  defaults: {
    accessToken: '',
    enableSudoMode: false,
    usePlugin: true, // legacy opt. for enableSudoMode
    bridge: true,
    devtools: false,
    componentsDir: '~/storyblok',
    apiOptions: {},
    enableServerClient: false,
  },
  setup(options: AllModuleOptions, nuxt: Nuxt) {
    const resolver = createResolver(import.meta.url);

    if (nuxt.options.vite.optimizeDeps) {
      nuxt.options.vite.optimizeDeps.include
        = nuxt.options.vite.optimizeDeps.include || [];
      nuxt.options.vite.optimizeDeps.include.push('@storyblok/vue');

      nuxt.options.vite.optimizeDeps.exclude
        = nuxt.options.vite.optimizeDeps.exclude || [];
      nuxt.options.vite.optimizeDeps.exclude.push('fsevents');
    }

    // Enable dirs
    if (options.componentsDir) {
      addComponentsDir({ path: options.componentsDir, global: true, pathPrefix: false });
    }
    nuxt.options.build.transpile.push(resolver.resolve('./runtime'));
    nuxt.options.build.transpile.push('@storyblok/nuxt');
    nuxt.options.build.transpile.push('@storyblok/vue');
    addImportsDir(resolver.resolve('./runtime/composables'));

    if (options.enableServerClient) {
      const { accessToken, ...publicOptions } = options;
      nuxt.options.runtimeConfig.storyblok = { accessToken };
      (nuxt.options.runtimeConfig.public.storyblok as unknown as PublicModuleOptions) = publicOptions;
    }
    else {
      nuxt.options.runtimeConfig.public.storyblok = options;
    }

    const enablePluginCondition = options.usePlugin === true && options.enableSudoMode === false;
    if (enablePluginCondition) {
      addPlugin(resolver.resolve('./runtime/plugin'));
    }

    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.alias = nitroConfig.alias || {};
      nitroConfig.alias['#storyblok/server'] = resolver.resolve('./runtime/server');
    });
    nuxt.options.alias['#storyblok/server'] = resolver.resolve('./runtime/server');

    // Add auto imports
    const names = [
      'useStoryblok',
      'useStoryblokApi',
      'useStoryblokBridge',
      'renderRichText',
      'StoryblokRichText',
      'useStoryblokRichText',
      'MarkTypes',
      'BlockTypes',
      'LinkTypes',
      'TextTypes',
      'ComponentBlok',
      'asTag',
      'StoryblokRichTextDocumentNode',
      'StoryblokRichTextImageOptimizationOptions',
      'StoryblokRichTextNode',
      'StoryblokRichTextNodeTypes',
      'StoryblokRichTextOptions',
    ];
    for (const name of names) {
      addImports({ name, as: name, from: '@storyblok/vue' });
    }
    if (!nuxt.options.imports.scan) {
      addImports({
        name: 'useAsyncStoryblok',
        as: 'useAsyncStoryblok',
        from: resolver.resolve('runtime/composables/useAsyncStoryblok'),
      });
    }

    nuxt.options.typescript.hoist.push('@storyblok/vue');

    if (options.devtools) {
      nuxt.hook('devtools:customTabs' as NuxtHookName, (iframeTabs: Array<unknown>): void => {
        iframeTabs.push({
          name: 'storyblok',
          title: 'Storyblok',
          icon: 'i-logos-storyblok-icon',
          view: {
            type: 'iframe',
            src: 'https://app.storyblok.com/#!/me/spaces/',
          },
        });
      });
    }
  },
});
