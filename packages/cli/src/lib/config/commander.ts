import type { CommanderCommand, PlainObject, ResolvedCliConfig } from './types';
import { getOptionPath, getValueAtPath, setValueAtPath } from './helpers';

// Sets defaults. If, at Commander flag-level, some options has defauls, they'll override
// the ones from the config file defaults
export function collectGlobalDefaults(root: CommanderCommand, baseDefaults: PlainObject): PlainObject {
  const defaults = baseDefaults;
  for (const option of root.options) {
    if (option.defaultValue === undefined) {
      continue;
    }
    // Nested global options (api.*, log.*, etc.) are projected into the config tree via path segments.
    setValueAtPath(defaults, getOptionPath(option), option.defaultValue);
  }
  return defaults;
}

export function collectLocalDefaults(commands: CommanderCommand[]): PlainObject {
  const defaults: PlainObject = {};
  for (const command of commands) {
    for (const option of command.options) {
      if (option.defaultValue === undefined) {
        continue;
      }
      const attrName = option.attributeName();
      if (!(attrName in defaults)) {
        defaults[attrName] = option.defaultValue;
      }
    }
  }
  return defaults;
}

// Translate explicit CLI flags into config objects: root options mutate the global tree,
// nested commands only patch their own local option bag (no deep paths involved).
export function applyCliOverrides(commandChain: CommanderCommand[], globalResolved: PlainObject, localResolved: PlainObject): void {
  const [root] = commandChain;
  for (const command of commandChain) {
    const isRoot = command === root;
    for (const option of command.options) {
      const attrName = option.attributeName();
      const source = command.getOptionValueSource(attrName);
      // Skip commander defaults/config hydration so we only react to explicit CLI input.
      if (!source || source === 'default' || source === 'config') {
        continue;
      }
      const value = command.getOptionValue(attrName);
      if (isRoot) {
        setValueAtPath(globalResolved, getOptionPath(option), value);
      }
      else {
        localResolved[attrName] = value;
      }
    }
  }
}

// Hydrate Commander options with resolved config so downstream logic can rely on option values.
export function applyConfigToCommander(commandChain: CommanderCommand[], resolved: ResolvedCliConfig): void {
  for (const command of commandChain) {
    for (const option of command.options) {
      const attrName = option.attributeName();
      const source = command.getOptionValueSource(attrName);
      // Never overwrite explicit CLI flags; only hydrate values that still come from defaults.
      if (source && source !== 'default' && source !== 'config') {
        continue;
      }
      const value = getValueAtPath(resolved, getOptionPath(option));
      if (value === undefined) {
        continue;
      }
      command.setOptionValueWithSource(attrName, value, 'config');
    }
  }
}
