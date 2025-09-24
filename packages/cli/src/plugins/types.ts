import type { Command } from 'commander';

export interface PluginCommandOption {
  flags: string;
  description?: string;
  defaultValue?: string | boolean | string[];
}

export interface PluginCommand {
  name: string;
  description?: string;
  aliases?: string[];
  options?: PluginCommandOption[];
  action: (options: Record<string, any>, ...args: any[]) => Promise<void> | void;
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  commands?: PluginCommand[];
  main?: string;
}

export interface Plugin {
  actions: Record<string, (options: Record<string, any>, ...args: any[]) => Promise<void> | void>;
  initialize?: () => Promise<void> | void;
  dispose?: () => Promise<void> | void;
}

export interface PluginSource {
  type: 'local';
  location: string;
}

export interface InstalledPlugin {
  manifest: PluginManifest;
  source: PluginSource;
  installPath: string;
  installedAt: Date;
  isLinked?: boolean; // true if symlinked for development, false/undefined if copied
}

export interface PluginRegistry {
  plugins: Record<string, InstalledPlugin>;
  version: string;
}

export interface PluginContext {
  program: Command;
  logger: any; // konsola instance
  session: any; // session instance
  utils: any; // utility functions
}
