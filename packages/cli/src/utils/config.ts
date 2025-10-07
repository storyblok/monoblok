import { loadConfig } from 'c12';
import type { Command } from 'commander';

export interface StoryblokConfig {
  verbose: boolean;
  modules: Record<string, any>;
}

export async function resolveConfig(thisCommand: Command): Promise<Record<string, any>> {
  // Helper function to extract option values from config, excluding nested objects
  const extractOptions = (configObject: Record<string, any>): Record<string, any> => {
    const options: Record<string, any> = {};
    for (const [key, value] of Object.entries(configObject)) {
      // Skip nested command configs (objects that might be subcommands)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        continue;
      }
      options[key] = value;
    }
    return options;
  };

  // Build command path from root to current command
  const getCommandPath = (cmd: Command): string[] => {
    const parts: string[] = [];
    let current: Command | null = cmd;

    while (current && current.name()) {
      parts.unshift(current.name());
      current = current.parent;
    }

    return parts;
  };

  // Collect all CLI default values from all commands in hierarchy
  const getAllDefaults = (cmd: Command): Record<string, any> => {
    const defaults: Record<string, any> = {};
    const commands: Command[] = [];

    // Build list of commands from root to current
    let current: Command | null = cmd;
    while (current) {
      commands.unshift(current);
      current = current.parent;
    }

    // Collect defaults from all commands
    for (const command of commands) {
      for (const option of command.options) {
        const attrName = option.attributeName();
        if (option.defaultValue !== undefined) {
          defaults[attrName] = option.defaultValue;
        }
      }
    }

    return defaults;
  };

  // Start with CLI defaults
  const resolvedOpts: Record<string, any> = { ...getAllDefaults(thisCommand) };

  // Load config and layer it on top
  const { config } = await loadConfig({
    name: 'storyblok',
    defaults: {},
  });

  if (!config) {
    // Even without config, collect CLI args to override defaults
    const commands: Command[] = [];
    let current: Command | null = thisCommand;
    while (current) {
      commands.unshift(current);
      current = current.parent;
    }
    for (const command of commands) {
      Object.assign(resolvedOpts, command.opts());
    }
    return resolvedOpts;
  }

  // Apply global config (excluding 'modules' key)
  const { modules, ...globalConfig } = config;
  Object.assign(resolvedOpts, extractOptions(globalConfig));

  // Layer in command-specific config from modules namespace
  if (modules) {
    const commandPath = getCommandPath(thisCommand);

    // Navigate through nested config following command path, accumulating options
    let currentConfig: any = modules;
    for (const commandName of commandPath) {
      if (currentConfig[commandName]) {
        // Merge config at this level
        Object.assign(resolvedOpts, extractOptions(currentConfig[commandName]));
        // Move deeper for potential subcommands
        currentConfig = currentConfig[commandName];
      }
      else {
        break;
      }
    }
  }

  // Collect only EXPLICITLY SET CLI arguments from all commands in the hierarchy
  // We check the value source to distinguish between defaults and user-provided values
  const getExplicitCliOpts = (cmd: Command): Record<string, any> => {
    const explicitOpts: Record<string, any> = {};
    const commands: Command[] = [];

    // Build list of commands from root to current
    let current: Command | null = cmd;
    while (current) {
      commands.unshift(current);
      current = current.parent;
    }

    // Collect only explicitly set options (source is not 'default')
    for (const command of commands) {
      for (const option of command.options) {
        const attrName = option.attributeName();
        const valueSource = command.getOptionValueSource(attrName);

        // Only include if explicitly set via CLI (not using default value)
        if (valueSource && valueSource !== 'default') {
          explicitOpts[attrName] = command.getOptionValue(attrName);
        }
      }
    }

    return explicitOpts;
  };

  // Explicitly set CLI arguments override everything
  Object.assign(resolvedOpts, getExplicitCliOpts(thisCommand));

  return resolvedOpts;
}
