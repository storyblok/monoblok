import { PluginManager } from './manager';
import { konsola } from '../utils';

export async function initializePluginSystem(): Promise<void> {
  try {
    const pluginManager = PluginManager.getInstance();
    await pluginManager.initialize();
  }
  catch {
    konsola.warn('Failed to initialize plugin system');
  }
}

export { PluginManager };
export * from './types';
