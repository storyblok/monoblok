import { Command } from 'commander';
import { join, resolve } from 'node:path';
import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { getProgram } from '../../program';
import { PluginManager } from '../../plugins/manager';
import { konsola } from '../../utils';
import { saveToFile } from '../../utils/filesystem';
import { colorPalette } from '../../constants';
import type { PluginSource } from '../../plugins/types';

const program = getProgram();

// Create plugin function
async function createPlugin(
  pluginName?: string,
  packageName?: string,
  packageManager?: 'npm' | 'yarn' | 'pnpm',
): Promise<void> {
  konsola.title('Create Plugin', colorPalette.PRIMARY);

  // Prompt for plugin name if not provided
  if (!pluginName) {
    pluginName = await input({
      message: 'What is your plugin name?',
      validate: (value) => {
        if (!value.trim()) {
          return 'Plugin name is required';
        }
        if (!/^[a-z0-9-]+$/.test(value)) {
          return 'Plugin name must contain only lowercase letters, numbers, and hyphens';
        }
        return true;
      },
    });
  }

  // Prompt for package name if not provided (default to plugin name)
  if (!packageName) {
    packageName = await input({
      message: 'What is your package name?',
      default: pluginName,
      validate: (value) => {
        if (!value.trim()) {
          return 'Package name is required';
        }
        if (!/^[a-z0-9-@/]+$/.test(value)) {
          return 'Package name must be a valid npm package name';
        }
        return true;
      },
    });
  }

  // Prompt for package manager if not provided
  if (!packageManager) {
    packageManager = await select({
      message: 'Which package manager would you like to use?',
      choices: [
        { name: 'pnpm', value: 'pnpm' },
        { name: 'yarn', value: 'yarn' },
        { name: 'npm', value: 'npm' },
      ],
    });
  }

  const pluginDir = resolve(process.cwd(), pluginName);

  try {
    // Generate package.json
    const packageJson = {
      name: packageName,
      version: '1.0.0',
      description: `A Storyblok CLI plugin: ${pluginName}`,
      main: 'index.js',
      type: 'module',
      packageManager: packageManager !== 'npm' ? `${packageManager}@latest` : undefined,
      scripts: {
        dev: 'node index.js',
        test: 'echo "Error: no test specified" && exit 1',
      },
      keywords: ['storyblok', 'cli', 'plugin'],
      author: '',
      license: 'MIT',
      storyblok: {
        name: pluginName,
        commands: [
          {
            name: 'hello',
            description: 'Say hello command',
            aliases: ['hi'],
            options: [
              {
                flags: '-n, --name <name>',
                description: 'Your name',
              },
            ],
          },
        ],
        hooks: [`${pluginName}:custom-hook`],
      },
    };

    // Remove packageManager field if npm
    if (packageManager === 'npm') {
      delete packageJson.packageManager;
    }

    await saveToFile(
      join(pluginDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );
    konsola.ok(`Created directory: ${pluginDir}`);
    konsola.ok('Created package.json');

    // Generate index.js (plugin implementation)
    const indexJs = `// ${pluginName} plugin for Storyblok CLI
export default function createPlugin(context) {
  const { logger, mapiClient, utils, runCommand, getPlugin, runHook } = context;

  return {
    // Command actions
    actions: {
      hello: async (options) => {
        const name = options.name || 'World';
        logger.info(\`👋 Hello, \${name}!\`);
        
        // 🌐 Access Storyblok Management API
        // const spaces = await mapiClient.get('spaces');
        // logger.info(\`Found \${spaces.length} spaces\`);
        
        // 🛠️ Use utility functions
        // const configPath = utils.getStoryblokGlobalPath();
        // logger.info(\`Config directory: \${configPath}\`);
        
        // 🔗 Run other CLI commands
        // await runCommand('components', ['pull']);
        
        // 🔌 Access other plugins and run their commands
        // const otherPlugin = getPlugin('other-plugin-name');
        // if (otherPlugin && otherPlugin.actions.someCommand) {
        //   await otherPlugin.actions.someCommand({ param: 'value' });
        // }
        
        // 🔥 Trigger custom hooks
        await runHook('${pluginName}:custom-hook', { 
          message: \`Hello from \${name}\`,
          timestamp: new Date().toISOString()
        });
      }
    },

    // Lifecycle hooks (optional)
    hooks: {
      init: async () => {
        logger.info('🚀 ${pluginName} plugin initialized');
      },
      
      'before-command': async ({ args }) => {
        if (args.includes('${pluginName}')) {
          logger.info('🔧 ${pluginName} plugin preparing command...');
        }
      },
      
      'after-command': async ({ args }) => {
        logger.info('✅ ${pluginName} plugin completed command:', args[0]);
      },
      
      'on-error': async ({ error, args }) => {
        logger.error('❌ ${pluginName} plugin error on command:', args[0], error?.message);
      },
      
      teardown: async ({ error }) => {
        if (error) {
          logger.info('🧹 ${pluginName} plugin cleanup after error');
        } else {
          logger.info('🧹 ${pluginName} plugin normal cleanup');
        }
      },

      // Custom hook implementation
      '${pluginName}:custom-hook': async (context) => {
        logger.info('🎯 Custom hook triggered:', context);
      }
    }
  };
}
`;

    await saveToFile(join(pluginDir, 'index.js'), indexJs);
    konsola.ok('Created index.js');

    // Generate README.md
    const readme = `# ${pluginName} Plugin

A Storyblok CLI plugin that provides custom functionality.

## Installation

\`\`\`bash
# For development (changes reflect immediately)
storyblok plugins link ./${pluginName}

# For production use
storyblok plugins install ./${pluginName}
\`\`\`

## Usage

\`\`\`bash
# Say hello
storyblok ${pluginName} hello --name "Your Name"

# Using alias
storyblok ${pluginName} hi --name "Developer"
\`\`\`

## Development

\`\`\`bash
# Install dependencies (if any)
${packageManager} install

# Test the plugin
node index.js
\`\`\`

## Hooks

This plugin provides:
- **\`${pluginName}:custom-hook\`** - Triggered when hello command runs

## License

MIT
`;

    await saveToFile(join(pluginDir, 'README.md'), readme);
    konsola.ok('Created README.md');

    konsola.br();
    konsola.ok('Plugin created successfully! 🎉');
    konsola.br();

    // Next steps
    konsola.info('Next steps:');
    console.log(`  1. Navigate to your plugin: ${chalk.cyan(`cd ${pluginName}`)}`);
    console.log(`  2. For development: ${chalk.cyan(`storyblok plugins link ./${pluginName}`)}`);
    console.log(`  3. Test your plugin: ${chalk.cyan(`storyblok ${pluginName} hello --name "Test"`)}`);
    console.log(`  4. For production: ${chalk.cyan(`storyblok plugins install ./${pluginName}`)}`);
    konsola.br();
    konsola.info('📚 Documentation: https://github.com/storyblok/monoblok/blob/main/packages/cli/src/commands/plugins/README.md');
  }
  catch (error) {
    konsola.error('Failed to create plugin:', error);
    process.exit(1);
  }
}

// Plugin install command
export const pluginInstallCommand = program
  .command('plugins')
  .description('Manage CLI plugins')
  .addCommand(
    new Command('install')
      .argument('<source>', 'Plugin source (local path or GitHub repo)')
      .option('-t, --type <type>', 'Source type: local', 'local')
      .description('Install a plugin from local path')
      .action(async (source: string, options: { type: 'local' }) => {
        konsola.title('Plugin Install', colorPalette.PRIMARY);

        const pluginManager = PluginManager.getInstance();
        await pluginManager.initialize();

        const pluginSource: PluginSource = {
          type: options.type,
          location: source,
        };

        try {
          await pluginManager.installPlugin(pluginSource);
        }
        catch (error) {
          konsola.error('Failed to install plugin', error);
          process.exit(1);
        }
      }),
  )
  .addCommand(
    new Command('link')
      .argument('<source>', 'Plugin source (local path)')
      .description('Link a plugin for development (creates symlink)')
      .action(async (source: string) => {
        konsola.title('Plugin Link', colorPalette.PRIMARY);

        const pluginManager = PluginManager.getInstance();
        await pluginManager.initialize();

        const pluginSource: PluginSource = {
          type: 'local',
          location: source,
        };

        try {
          await pluginManager.linkPlugin(pluginSource);
        }
        catch (error) {
          konsola.error('Failed to link plugin', error);
          process.exit(1);
        }
      }),
  )
  .addCommand(
    new Command('unlink')
      .argument('<name>', 'Plugin name to unlink')
      .description('Unlink a development plugin')
      .action(async (name: string) => {
        konsola.title('Plugin Unlink', colorPalette.PRIMARY);

        const pluginManager = PluginManager.getInstance();
        await pluginManager.initialize();

        try {
          await pluginManager.unlinkPlugin(name);
        }
        catch (error) {
          konsola.error('Failed to unlink plugin', error);
          process.exit(1);
        }
      }),
  )
  .addCommand(
    new Command('uninstall')
      .argument('<name>', 'Plugin name to uninstall')
      .description('Uninstall a plugin (works for both installed and linked plugins)')
      .action(async (name: string) => {
        konsola.title('Plugin Uninstall', colorPalette.PRIMARY);

        const pluginManager = PluginManager.getInstance();
        await pluginManager.initialize();

        try {
          await pluginManager.uninstallPlugin(name);
        }
        catch (error) {
          konsola.error('Failed to uninstall plugin', error);
          process.exit(1);
        }
      }),
  )
  .addCommand(
    new Command('create')
      .argument('[name]', 'Plugin name (will prompt if not provided)')
      .option('-n, --package-name <name>', 'Package name (defaults to plugin name)')
      .option('-p, --package-manager <manager>', 'Package manager (npm, yarn, pnpm)')
      .description('Create a new plugin with basic template')
      .action(async (name: string | undefined, options: { packageName?: string; packageManager?: 'npm' | 'yarn' | 'pnpm' }) => {
        await createPlugin(name, options.packageName, options.packageManager);
      }),
  )
  .addCommand(
    new Command('list')
      .description('List installed plugins')
      .action(async () => {
        konsola.title('Installed Plugins', colorPalette.PRIMARY);

        const pluginManager = PluginManager.getInstance();
        await pluginManager.initialize();

        const plugins = pluginManager.listPlugins();

        if (plugins.length === 0) {
          konsola.info('No plugins installed');
          return;
        }

        konsola.info(`Found ${plugins.length} installed plugin(s):`);
        konsola.br();

        for (const plugin of plugins) {
          const status = plugin.isLinked ? 'linked' : 'installed';
          const statusIcon = plugin.isLinked ? '🔗' : '📦';

          console.log(`${statusIcon} ${plugin.manifest.name}@${plugin.manifest.version} (${status})`);
          console.log(`  Source: ${plugin.source.type}:${plugin.source.location}`);
          console.log(`  ${status === 'linked' ? 'Linked' : 'Installed'}: ${new Date(plugin.installedAt).toLocaleDateString()}`);

          if (plugin.manifest.commands && plugin.manifest.commands.length > 0) {
            console.log(`  Commands: ${plugin.manifest.commands.map((cmd: any) => cmd.name).join(', ')}`);
          }

          console.log();
        }
      }),
  );
