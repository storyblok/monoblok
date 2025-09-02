import type { Plugin } from 'vite';
import type { IntegrationOptions } from '../lib/storyblok-integration';

export function vitePluginStoryblokOptions(
  options: IntegrationOptions,
): Plugin {
  const virtualModuleId = `virtual:storyblok-options`;
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;

  return {
    name: 'vite-plugin-storyblok-options',
    async resolveId(id: string) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id: string) {
      if (id === resolvedVirtualModuleId) {
        return `export default ${JSON.stringify(options)}`;
      }
    },
  };
}
