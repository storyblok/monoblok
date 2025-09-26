import type { Command } from 'commander';
import type { ManagementApiClient } from '@storyblok/management-api-client';

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
  commands?: PluginCommand[];
  hooks?: string[]; // Custom hook names that this plugin provides
}

// Hook function type
export type HookFunction<T = any> = (context: HookContext & T) => Promise<void> | void;

// Hook context passed to hook functions
export interface HookContext {
  config: any;
  exit: (code?: number) => never;
  error: (message: string | Error, options?: { code?: string; exit?: number }) => never;
}

// Built-in lifecycle hook events
export type LifecycleHook =
  | 'init' // Runs when CLI is initialized
  | 'before-command' // Runs before command execution
  | 'after-command' // Runs after successful command execution
  | 'on-error' // Runs when command fails
  | 'teardown'; // Runs when CLI is shutting down

export interface Plugin {
  actions: Record<string, (options: Record<string, any>, ...args: any[]) => Promise<void> | void>;
  hooks?: Record<string, HookFunction | HookFunction[]>; // Hook handlers (includes init and teardown lifecycle hooks)
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
  utils: any; // utility functions
  mapiClient: ManagementApiClient; // Management API client
  runCommand: (command: string, args?: string[]) => Promise<void>; // Run other CLI commands
  getPlugin: (name: string) => Plugin | undefined; // Access other loaded plugins
  runHook: (hookName: string, context?: any) => Promise<void>; // Run custom hooks
}
