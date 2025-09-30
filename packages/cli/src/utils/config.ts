import { loadConfig } from 'c12';
import type { Command } from 'commander';

export interface StoryblokConfig {
  verbose: boolean;
}

export async function resolveConfig(thisCommand: Command): Promise<void> {
  // Load config defaults
  const { config } = await loadConfig({
    name: 'storyblok',
    defaults: {},
  });

  if (!config) { return; }

  // Apply config defaults for options that weren't explicitly set via CLI
  for (const [key, value] of Object.entries(config)) {
    // Check both local command options and parent options
    let targetCommand = thisCommand;
    let option = thisCommand.options.find((opt) => {
      const attrName = opt.attributeName();
      return attrName === key || opt.long === `--${key}`;
    });

    // If not found on current command, check parent command
    if (!option && thisCommand.parent) {
      targetCommand = thisCommand.parent;
      option = thisCommand.parent.options.find((opt) => {
        const attrName = opt.attributeName();
        return attrName === key || opt.long === `--${key}`;
      });
    }

    if (option) {
      const currentValue = targetCommand.getOptionValue(key);
      const valueSource = targetCommand.getOptionValueSource(key);

      // Only set config value if the option is still at its default value or undefined
      if (valueSource === 'default' || currentValue === undefined) {
        targetCommand.setOptionValue(key, value);
      }
    }
  }
}
