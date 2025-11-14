import type { CommanderCommand, PlainObject, ResolvedCliConfig } from './types';
import { createDefaultResolvedConfig, DEFAULT_GLOBAL_CONFIG } from './defaults';
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
import { isPlainObject, mergeDeep } from '../utils/object';

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
  const commandChain = Array.isArray(ancestry)
    ? ancestry
    : ancestry
      ? getCommandAncestry(ancestry)
      : getCommandAncestry(thisCommand);
  const [root, ...rest] = commandChain;

  const globalDefaults = collectGlobalDefaults(root, structuredClone(DEFAULT_GLOBAL_CONFIG) as PlainObject);
  const localDefaults = collectLocalDefaults(rest);

  const globalResolved = structuredClone(globalDefaults);
  const localResolved = structuredClone(localDefaults);

  const layers = await loadConfigLayers();
  for (const layer of layers) {
    const { modules, ...globalLayer } = layer;
    // Later layers overwrite earlier ones because loadConfigLayers orders them from general to specific.
    mergeDeep(globalResolved, globalLayer);
    if (modules && isPlainObject(modules)) {
      mergeModuleConfig(localResolved, modules, rest);
    }
  }

  applyCliOverrides(commandChain, globalResolved, localResolved);

  const resolved = createDefaultResolvedConfig();
  mergeDeep(resolved as PlainObject, globalResolved);
  Object.assign(resolved, localResolved);

  return resolved;
}
