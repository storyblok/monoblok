import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { konsola } from '../utils';
import { getStoryblokGlobalPath, readJsonFile, saveToFile } from '../utils/filesystem';
import type {
  InstalledPlugin,
  Plugin,
  PluginContext,
  PluginManifest,
  PluginRegistry,
  PluginSource,
} from './types';
import { getProgram } from '../program';
import { session } from '../session';
import * as utils from '../utils';

export class PluginManager {
  private static instance: PluginManager;
  private registry: PluginRegistry;
  private registryPath: string;
  private pluginsDir: string;
  private loadedPlugins: Map<string, Plugin> = new Map();

  constructor() {
    const configDir = getStoryblokGlobalPath();
    this.registryPath = join(configDir, 'plugins-registry.json');
    this.pluginsDir = join(configDir, 'plugins');
    this.registry = { plugins: {}, version: '1.0.0' };
  }

  static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure plugins directory exists
      await fs.mkdir(this.pluginsDir, { recursive: true });

      // Load existing registry
      await this.loadRegistry();

      // Only load plugins if not already loaded
      if (this.loadedPlugins.size === 0) {
        // Load all installed plugins
        await this.loadInstalledPlugins();
      }
    }
    catch {
      konsola.warn('Failed to initialize plugin manager:');
    }
  }

  private async loadRegistry(): Promise<void> {
    const result = await readJsonFile<PluginRegistry>(this.registryPath);
    if (result.error) {
      // Registry doesn't exist yet, use default
      await this.saveRegistry();
    }
    else {
      this.registry = result.data[0] || { plugins: {}, version: '1.0.0' };
    }
  }

  private async saveRegistry(): Promise<void> {
    await saveToFile(this.registryPath, JSON.stringify(this.registry, null, 2));
  }

  private async loadInstalledPlugins(): Promise<void> {
    for (const [pluginName, installedPlugin] of Object.entries(this.registry.plugins)) {
      try {
        await this.loadPlugin(pluginName, installedPlugin);
      }
      catch {
        konsola.warn(`Failed to load plugin ${pluginName}:`);
      }
    }
  }

  private async loadPlugin(pluginName: string, installedPlugin: InstalledPlugin): Promise<void> {
    // Check if plugin is already loaded
    if (this.loadedPlugins.has(pluginName)) {
      return;
    }

    const pluginPath = installedPlugin.installPath;
    const manifestPath = join(pluginPath, 'plugin.json');

    try {
      // Load manifest using the filesystem utility
      const manifestResult = await readJsonFile<PluginManifest>(manifestPath);
      if (manifestResult.error) {
        throw manifestResult.error;
      }
      const manifest = manifestResult.data[0];

      // Load plugin module
      const mainFile = manifest.main || 'index.js';
      const pluginModule = await import(join(pluginPath, mainFile));

      let plugin: Plugin;
      if (typeof pluginModule.default === 'function') {
        // Plugin is a factory function
        plugin = await pluginModule.default(this.createPluginContext());
      }
      else if (typeof pluginModule.default === 'object') {
        // Plugin is an object
        plugin = pluginModule.default;
      }
      else {
        throw new TypeError('Plugin must export a function or object as default export');
      }

      // Initialize plugin if it has an initialize method
      if (plugin.initialize) {
        await plugin.initialize();
      }

      // Register commands using manifest and plugin actions
      this.registerPluginCommands(manifest, plugin);

      // Store loaded plugin
      this.loadedPlugins.set(pluginName, plugin);

      konsola.ok(`Loaded plugin: ${pluginName}`);
    }
    catch (error) {
      konsola.error(`Failed to load plugin ${pluginName}:`, error);
    }
  }

  private createPluginContext(): PluginContext {
    return {
      program: getProgram(),
      logger: konsola,
      session: session(),
      utils,
    };
  }

  private registerPluginCommands(manifest: PluginManifest, plugin: Plugin): void {
    const program = getProgram();

    // Create a parent command for the plugin
    const pluginCommand = program.command(manifest.name);
    pluginCommand.description(`Commands from ${manifest.name} plugin`);

    // Use commands from manifest if available, otherwise fall back to plugin commands
    const commands = manifest.commands || [];

    for (const command of commands) {
      const cmd = pluginCommand.command(command.name);

      if (command.description) {
        cmd.description(command.description);
      }

      if (command.aliases) {
        cmd.aliases(command.aliases);
      }

      // Add options
      if (command.options) {
        for (const option of command.options) {
          if (option.defaultValue !== undefined) {
            cmd.option(option.flags, option.description, option.defaultValue);
          }
          else {
            cmd.option(option.flags, option.description);
          }
        }
      }

      // Set action from plugin actions
      cmd.action(async (options, ...args) => {
        try {
          const actionHandler = plugin.actions[command.name];
          if (!actionHandler) {
            throw new Error(`Action handler for command '${command.name}' not found in plugin`);
          }
          await actionHandler(options, ...args);
        }
        catch (error) {
          konsola.error(`Plugin command '${command.name}' failed:`, error);
          process.exit(1);
        }
      });
    }
  }

  async installPlugin(source: PluginSource): Promise<void> {
    const pluginName = this.extractPluginName(source);
    const installPath = join(this.pluginsDir, pluginName);

    konsola.info(`Installing plugin: ${pluginName}`);

    try {
      // Remove existing installation
      await this.removeDirectory(installPath);

      // Install based on source type
      switch (source.type) {
        case 'local':
          await this.installFromLocal(source.location, installPath);
          break;
        default:
          throw new Error(`Unsupported source type: ${source.type}`);
      }

      // Load manifest using filesystem utility
      const manifestPath = join(installPath, 'plugin.json');
      const manifestResult = await readJsonFile<PluginManifest>(manifestPath);
      if (manifestResult.error) {
        throw manifestResult.error;
      }
      const manifest = manifestResult.data[0];

      // Update registry with resolved source path
      const resolvedSource: PluginSource = {
        ...source,
        location: resolve(source.location),
      };

      const installedPlugin: InstalledPlugin = {
        manifest,
        source: resolvedSource,
        installPath,
        installedAt: new Date(),
      };

      this.registry.plugins[pluginName] = installedPlugin;
      await this.saveRegistry();

      // Load the plugin (if not already loaded)
      if (!this.loadedPlugins.has(pluginName)) {
        await this.loadPlugin(pluginName, installedPlugin);
      }

      konsola.ok(`Successfully installed plugin: ${pluginName}`);
    }
    catch (error) {
      konsola.error(`Failed to install plugin ${pluginName}:`, error);
      throw error;
    }
  }

  async linkPlugin(source: PluginSource): Promise<void> {
    const pluginName = this.extractPluginName(source);
    const resolvedSourcePath = resolve(source.location);
    const linkPath = join(this.pluginsDir, pluginName);

    konsola.info(`Linking plugin: ${pluginName}`);

    try {
      // Check if plugin is already installed or linked
      if (this.registry.plugins[pluginName]) {
        const existing = this.registry.plugins[pluginName];
        if (existing.isLinked) {
          konsola.warn(`Plugin '${pluginName}' is already linked from ${existing.source.location}`);
          return;
        }
        else {
          konsola.info(`Plugin '${pluginName}' is installed. Unlinking first...`);
          await this.uninstallPlugin(pluginName);
        }
      }

      // Ensure plugins directory exists
      await fs.mkdir(this.pluginsDir, { recursive: true });

      // Remove existing link/directory if it exists
      await this.removeDirectory(linkPath);

      // Create symlink
      await fs.symlink(resolvedSourcePath, linkPath, 'dir');

      // Load manifest
      const manifestPath = join(linkPath, 'plugin.json');
      const manifestResult = await readJsonFile<PluginManifest>(manifestPath);
      if (manifestResult.error) {
        throw manifestResult.error;
      }
      const manifest = manifestResult.data[0];

      // Update registry with resolved source path
      const resolvedSource: PluginSource = {
        ...source,
        location: resolve(source.location),
      };

      const linkedPlugin: InstalledPlugin = {
        manifest,
        source: resolvedSource,
        installPath: linkPath,
        installedAt: new Date(),
        isLinked: true,
      };

      this.registry.plugins[pluginName] = linkedPlugin;
      await this.saveRegistry();

      // Load the plugin (if not already loaded)
      if (!this.loadedPlugins.has(pluginName)) {
        await this.loadPlugin(pluginName, linkedPlugin);
      }

      konsola.ok(`Successfully linked plugin: ${pluginName} -> ${resolvedSourcePath}`);
    }
    catch (error) {
      konsola.error(`Failed to link plugin ${pluginName}:`, error);
      throw error;
    }
  }

  private extractPluginName(source: PluginSource): string {
    // Resolve path - if absolute, use as-is; if relative, resolve from cwd
    const resolvedPath = resolve(source.location);
    return resolvedPath.split('/').pop() || 'unknown';
  }

  private async installFromLocal(localPath: string, installPath: string): Promise<void> {
    const resolvedPath = resolve(localPath);
    await this.copyDirectory(resolvedPath, installPath);
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      // Skip node_modules to avoid dependency conflicts and socket errors
      if (entry.name === 'node_modules') {
        continue;
      }

      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      try {
        if (entry.isDirectory()) {
          await this.copyDirectory(srcPath, destPath);
        }
        else if (entry.isFile()) {
          await fs.copyFile(srcPath, destPath);
        }
        // Skip other types (sockets, pipes, etc.) that can't be copied
      }
      catch (error: any) {
        // Log the error but continue with other files
        konsola.warn(`Failed to copy ${srcPath}: ${error.message}`);
      }
    }
  }

  private async removeDirectory(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    }
    catch {
      // Directory doesn't exist, ignore
    }
  }

  async unlinkPlugin(pluginName: string): Promise<void> {
    if (!this.registry.plugins[pluginName]) {
      throw new Error(`Plugin '${pluginName}' is not installed or linked`);
    }

    const pluginInfo = this.registry.plugins[pluginName];
    if (!pluginInfo.isLinked) {
      throw new Error(`Plugin '${pluginName}' is installed, not linked. Use 'uninstall' command instead.`);
    }

    konsola.info(`Unlinking plugin: ${pluginName}`);

    try {
      const plugin = this.loadedPlugins.get(pluginName);
      if (plugin?.dispose) {
        await plugin.dispose();
      }

      // Remove symlink
      const linkPath = pluginInfo.installPath;
      await this.removeDirectory(linkPath);

      // Remove from registry
      delete this.registry.plugins[pluginName];
      await this.saveRegistry();

      // Remove from loaded plugins
      this.loadedPlugins.delete(pluginName);

      konsola.ok(`Successfully unlinked plugin: ${pluginName}`);
    }
    catch (error) {
      konsola.error(`Failed to unlink plugin ${pluginName}:`, error);
      throw error;
    }
  }

  async uninstallPlugin(pluginName: string): Promise<void> {
    if (!this.registry.plugins[pluginName]) {
      throw new Error(`Plugin '${pluginName}' is not installed`);
    }

    const pluginInfo = this.registry.plugins[pluginName];
    const action = pluginInfo.isLinked ? 'Unlinking' : 'Uninstalling';

    konsola.info(`${action} plugin: ${pluginName}`);

    try {
      const plugin = this.loadedPlugins.get(pluginName);
      if (plugin?.dispose) {
        await plugin.dispose();
      }

      // Remove from filesystem
      const installPath = pluginInfo.installPath;
      await this.removeDirectory(installPath);

      // Remove from registry
      delete this.registry.plugins[pluginName];
      await this.saveRegistry();

      // Remove from loaded plugins
      this.loadedPlugins.delete(pluginName);

      konsola.ok(`Successfully ${action.toLowerCase()} plugin: ${pluginName}`);
    }
    catch (error) {
      konsola.error(`Failed to uninstall plugin ${pluginName}:`, error);
      throw error;
    }
  }

  listPlugins(): InstalledPlugin[] {
    return Object.values(this.registry.plugins);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.loadedPlugins.get(name);
  }
}
