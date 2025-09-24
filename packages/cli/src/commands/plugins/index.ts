import { Command } from 'commander';
import { getProgram } from '../../program';
import { PluginManager } from '../../plugins/manager';
import { konsola } from '../../utils';
import { colorPalette } from '../../constants';
import type { PluginSource } from '../../plugins/types';

const program = getProgram();

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
          if (plugin.manifest.description) {
            console.log(`  ${plugin.manifest.description}`);
          }
          console.log(`  Source: ${plugin.source.type}:${plugin.source.location}`);
          console.log(`  ${status === 'linked' ? 'Linked' : 'Installed'}: ${new Date(plugin.installedAt).toLocaleDateString()}`);

          if (plugin.manifest.commands && plugin.manifest.commands.length > 0) {
            console.log(`  Commands: ${plugin.manifest.commands.map((cmd: any) => cmd.name).join(', ')}`);
          }

          console.log();
        }
      }),
  );
