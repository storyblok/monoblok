import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { konsola } from '../utils';
import { copyDirectory, getStoryblokGlobalPath, readJsonFile, removeDirectory, saveToFile } from '../utils/filesystem';
import type {
  HookContext,
  HookFunction,
  InstalledPlugin,
  LifecycleHook,
  Plugin,
  PluginContext,
  PluginManifest,
  PluginRegistry,
  PluginSource,
} from './types';
import { mapiClient } from '../api';
import { getProgram } from '../program';
import * as utils from '../utils';

export class PluginManager {
  private static instance: PluginManager;
  private registry: PluginRegistry;
  private registryPath: string;
  private pluginsDir: string;
  private loadedPlugins: Map<string, Plugin> = new Map();
  private hooks: Map<string, HookFunction[]> = new Map();

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

  private async loadManifest(pluginPath: string): Promise<PluginManifest | null> {
    // Try plugin.json first
    const pluginJsonPath = join(pluginPath, 'plugin.json');
    const pluginJsonResult = await readJsonFile<PluginManifest>(pluginJsonPath);

    if (!pluginJsonResult.error && pluginJsonResult.data[0]) {
      return pluginJsonResult.data[0];
    }

    // Fallback to package.json with storyblok key
    const packageJsonPath = join(pluginPath, 'package.json');
    const packageJsonResult = await readJsonFile<any>(packageJsonPath);

    if (!packageJsonResult.error && packageJsonResult.data[0]?.storyblok) {
      const packageJson = packageJsonResult.data[0];
      const storyblokConfig = packageJson.storyblok;

      // Only extract the essential fields for plugin manifest
      return {
        name: storyblokConfig.name || packageJson.name,
        version: storyblokConfig.version || packageJson.version,
        commands: storyblokConfig.commands || [],
        hooks: storyblokConfig.hooks || [],
      };
    }

    return null;
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

    try {
      // Load manifest using the utility function
      const manifest = await this.loadManifest(pluginPath);
      if (!manifest) {
        throw new Error('No valid plugin manifest found');
      }

      // Load plugin module using Node.js module resolution
      // This will respect package.json's main, module, exports fields
      const pluginModule = await import(pluginPath);

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

      // Register commands using manifest and plugin actions
      this.registerPluginCommands(manifest, plugin);

      // Register custom hooks declared in manifest
      this.registerCustomHooks(manifest);

      // Register lifecycle hooks from plugin object if they exist
      if (plugin.hooks) {
        for (const [hookName, hookFunctions] of Object.entries(plugin.hooks)) {
          const functions = Array.isArray(hookFunctions) ? hookFunctions : [hookFunctions];
          for (const fn of functions) {
            this.registerHook(hookName, fn);
          }
        }
      }

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
      utils,
      mapiClient: mapiClient(),
      runCommand: this.createCommandRunner(),
      getPlugin: (name: string) => this.getPlugin(name),
      runHook: (hookName: string, context?: any) => this.runHook(hookName, context),
    };
  }

  private createCommandRunner() {
    return async (command: string, args: string[] = []): Promise<void> => {
      const program = getProgram();

      // Parse and execute the command
      try {
        // Create a new argv array with the command and args
        const argv = ['node', 'storyblok', command, ...args];
        await program.parseAsync(argv);
      }
      catch (error: any) {
        throw new Error(`Failed to run command "${command}": ${error.message}`);
      }
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
      await removeDirectory(installPath);

      // Install based on source type
      switch (source.type) {
        case 'local':
          await this.installFromLocal(source.location, installPath);
          break;
        default:
          throw new Error(`Unsupported source type: ${source.type}`);
      }

      // Load manifest using the utility function
      const manifest = await this.loadManifest(installPath);
      if (!manifest) {
        throw new Error('No valid plugin manifest found (plugin.json or package.json with storyblok config)');
      }

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
      await removeDirectory(linkPath);

      // Create symlink
      await fs.symlink(resolvedSourcePath, linkPath, 'dir');

      // Load manifest using the utility function
      const manifest = await this.loadManifest(linkPath);
      if (!manifest) {
        throw new Error('No valid plugin manifest found (plugin.json or package.json with storyblok config)');
      }

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
    await copyDirectory(resolvedPath, installPath);
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
      // Remove symlink
      const linkPath = pluginInfo.installPath;
      await removeDirectory(linkPath);

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
      // Remove from filesystem
      const installPath = pluginInfo.installPath;
      await removeDirectory(installPath);

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

  /**
   * Register a hook function for a specific hook event
   */
  private registerHook(hookName: string, hookFunction: HookFunction): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName)!.push(hookFunction);
  }

  /**
   * Run all hooks for a specific event
   */
  async runHook(hookName: string, context: any = {}): Promise<void> {
    const hookFunctions = this.hooks.get(hookName);
    if (!hookFunctions || hookFunctions.length === 0) {
      return;
    }

    const hookContext: HookContext = {
      config: this.registry,
      exit: (code = 0) => process.exit(code),
      error: (message: string | Error, options?: { code?: string; exit?: number }) => {
        const errorMessage = message instanceof Error ? message.message : message;
        konsola.error(errorMessage);
        if (options?.exit !== undefined) {
          process.exit(options.exit);
        }
        throw new Error(errorMessage);
      },
      ...context,
    };

    // Run all hooks in parallel (following oclif pattern)
    await Promise.all(
      hookFunctions.map(async (hookFn) => {
        try {
          await hookFn(hookContext);
        }
        catch (error) {
          // Log hook errors but don't fail the entire process
          konsola.warn(`Hook ${hookName} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }),
    );
  }

  /**
   * Run lifecycle hooks at specific points
   */
  async runLifecycleHook(hookName: LifecycleHook, context: any = {}): Promise<void> {
    await this.runHook(hookName, context);
  }

  /**
   * Register custom hooks declared in the plugin manifest
   */
  private registerCustomHooks(manifest: PluginManifest): void {
    if (!manifest.hooks) {
      return;
    }

    // Just register the hook names - implementations will be provided by plugins
    for (const hookName of manifest.hooks) {
      // Ensure the hook exists in our registry (create empty array if not)
      if (!this.hooks.has(hookName)) {
        this.hooks.set(hookName, []);
      }
      konsola.ok(`Registered custom hook: ${hookName}`);
    }
  }
}
