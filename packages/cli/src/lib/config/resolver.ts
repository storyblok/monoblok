import type { CommanderCommand, PlainObject, ResolvedCliConfig } from './types';
import { createDefaultResolvedConfig } from './defaults';
import {
  applyCliOverrides,
  collectGlobalDefaults,
  collectLocalDefaults,
} from './commander';
import {
  extractDirectValues,
  getCommandAncestry,
  loadConfigLayers,
} from './helpers';
import { isPlainObject, mergeDeep } from '../../utils/object';

// Modules are root subcommands that have their own subcommands (e.g. "components" has "pull"/"push").
// Leaf root commands like "login" or "logout" are not modules.
function getModuleNames(root: CommanderCommand): Set<string> {
  return new Set(
    root.commands
      .filter(cmd => cmd.commands.length > 0)
      .map(cmd => cmd.name()),
  );
}

function warnUnknownModuleKeys(modules: Record<string, any>, knownKeys: Set<string>): void {
  for (const key of Object.keys(modules)) {
    if (!knownKeys.has(key)) {
      console.warn(`[storyblok] Unknown module "${key}" in config file. Known modules: ${[...knownKeys].join(', ')}`);
    }
  }
}

// Walks the command chain (excluding root) and applies module-specific overrides at each level.
function mergeModuleConfig(target: PlainObject, modulesConfig: Record<string, any>, commands: CommanderCommand[]): void {
  let currentLevel: any = modulesConfig;
  for (const command of commands) {
    if (!isPlainObject(currentLevel)) {
      return;
    }
    const segment = currentLevel[command.name()];
    if (segment === undefined) {
      return;
    }
    if (isPlainObject(segment)) {
      Object.assign(target, extractDirectValues(segment));
      currentLevel = segment;
    }
    else {
      Object.assign(target, { [command.name()]: segment });
      return;
    }
  }
}

export async function resolveConfig(
  thisCommand: CommanderCommand,
  ancestry?: CommanderCommand[] | CommanderCommand,
): Promise<ResolvedCliConfig> {
  // Build the command hierarchy so we can split global vs local defaults and apply overrides in order.
  let commandChain: CommanderCommand[];
  if (Array.isArray(ancestry)) {
    commandChain = ancestry;
  }
  else if (ancestry) {
    commandChain = getCommandAncestry(ancestry);
  }
  else {
    commandChain = getCommandAncestry(thisCommand);
  }
  const [root, ...rest] = commandChain;

  // Create default config once and reuse it
  const defaultConfig = createDefaultResolvedConfig();
  const globalResolved = collectGlobalDefaults(root, defaultConfig);
  const localResolved = collectLocalDefaults(rest);

  const layers = await loadConfigLayers();
  const knownModuleKeys = getModuleNames(root);
  for (const layer of layers) {
    const { modules, ...globalLayer } = layer;
    // @todo(next-major): Remove deprecated api.maxConcurrency support from config files.
    // Handle deprecated api.maxConcurrency from config files
    if (globalLayer.api?.maxConcurrency !== undefined) {
      console.warn('[storyblok] Config option `api.maxConcurrency` is deprecated. Use `api.rateLimit` instead.');
      globalLayer.api.rateLimit = globalLayer.api.maxConcurrency;
      delete globalLayer.api.maxConcurrency;
    }
    // Later layers overwrite earlier ones because loadConfigLayers orders them from general to specific.
    mergeDeep(globalResolved, globalLayer);
    if (modules && isPlainObject(modules)) {
      warnUnknownModuleKeys(modules, knownModuleKeys);
      mergeModuleConfig(localResolved, modules, rest);
    }
  }

  applyCliOverrides(commandChain, globalResolved, localResolved);

  // @todo(next-major): Remove deprecated --api-max-concurrency CLI flag support.
  // Handle deprecated --api-max-concurrency CLI flag
  const globalResolvedApi = globalResolved.api;
  if (globalResolvedApi?.maxConcurrency !== undefined) {
    console.warn('[storyblok] CLI flag `--api-max-concurrency` is deprecated. Use `--api-rate-limit` instead.');
    globalResolvedApi.rateLimit = globalResolvedApi.maxConcurrency;
    delete globalResolvedApi.maxConcurrency;
  }

  const resolved = structuredClone(defaultConfig);
  mergeDeep(resolved as PlainObject, globalResolved);
  Object.assign(resolved, localResolved);

  if (resolved.space != null) {
    resolved.space = String(resolved.space);
  }

  return resolved;
}
