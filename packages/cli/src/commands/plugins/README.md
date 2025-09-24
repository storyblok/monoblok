# Storyblok CLI Plugin System

The Storyblok CLI plugin system allows developers to extend the CLI with custom commands. Plugins work by convention with minimal configuration required, making it easy to add new functionality to the Storyblok CLI.

## Key Features

- **Single Source of Truth**: Command structure defined in `plugin.json`
- **Action Handlers**: Implementation provides only the action functions
- **Automatic Help**: Help generation from manifest
- **Lifecycle Management**: Optional `initialize`/`dispose` hooks
- **Command Aliases**: Multiple names for commands
- **Development Linking**: Symlink plugins for development

## Plugin Commands

### Installation & Management
- `storyblok plugins install <path>` - Install a plugin from local path (copies files)
- `storyblok plugins link <path>` - Link a plugin for development (creates symlink)
- `storyblok plugins unlink <name>` - Unlink a development plugin
- `storyblok plugins uninstall <name>` - Uninstall a plugin (works for both installed and linked)
- `storyblok plugins list` - List all plugins with their status (installed/linked)

### Path Support
All commands support both relative and absolute paths:
```bash
# Relative paths (resolved from current directory)
storyblok plugins install ./my-plugin
storyblok plugins link ../my-other-plugin
storyblok plugins install .                    # Current directory

# Absolute paths
storyblok plugins install /path/to/my-plugin
```

### Development Workflow
```bash
# During development, link your plugin for instant updates
storyblok plugins link ./my-plugin

# Make changes to your plugin code...
# Changes are immediately available (no reinstall needed)

# When done developing
storyblok plugins unlink my-plugin

# Or install for production use
storyblok plugins install ./my-plugin
```

## Plugin Structure

A plugin requires:

```
my-plugin/
├── plugin.json          # Plugin manifest (required)
└── index.js            # Main plugin file
```

### Plugin Manifest (plugin.json)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Description of what the plugin does",
  "main": "index.js",
  "commands": [
    {
      "name": "hello",
      "description": "Say hello command",
      "aliases": ["hi"],
      "options": [
        {
          "flags": "-n, --name <name>",
          "description": "Your name"
        }
      ]
    }
  ]
}
```

### Plugin Implementation (index.js)

```javascript
export default function createPlugin(context) {
  const { logger, session, utils } = context;

  return {
    // Action handlers for commands defined in plugin.json
    actions: {
      hello: async (options) => {
        logger.info(`Hello, ${options.name || 'World'}!`);
      }
    },

    initialize: async () => {
      logger.info('Plugin initialized');
    },

    dispose: async () => {
      logger.info('Plugin disposed');
    }
  };
}
```

## Usage

Once installed or linked, use plugin commands:
```bash
storyblok <plugin-name> <command> [options]
```

Examples:
```bash
# Install a plugin
storyblok plugins install ./my-plugin

# Use the plugin
storyblok my-plugin hello --name "Alex"

# List all plugins (shows status: installed/linked)
storyblok plugins list

# For development - link instead of install
storyblok plugins link ./my-plugin
# Now any changes in ./my-plugin are immediately available
storyblok my-plugin hello --name "Dev"
```

## Plugin Status

The plugin system tracks two types of plugins:

### Installed Plugins 📦
- Files are **copied** to `~/.storyblok/plugins/<plugin-name>/`
- Independent of source directory
- Stable for production use
- Use `storyblok plugins install <path>`

### Linked Plugins 🔗
- **Symlinked** to source directory
- Changes reflect immediately
- Perfect for development
- Use `storyblok plugins link <path>`

Use `storyblok plugins list` to see the status of all plugins.

## Examples

- [examples/sample-plugin](../../../examples/sample-plugin/) - Basic plugin example
- [examples/wp-to-storyblok-plugin](../../../examples/wp-to-storyblok-plugin/) - Advanced plugin with multiple commands

## Plugin Context

The plugin receives a context object with:
- `logger` - CLI logger (konsola)
- `session` - Current CLI session
- `utils` - CLI utility functions
- `program` - Commander.js program instance

## Best Practices

### Development
1. Use `storyblok plugins link` during development
2. Keep your plugin in version control
3. Test with both relative and absolute paths
4. Use the provided context instead of importing CLI internals

### Distribution
1. Use `storyblok plugins install` for stable installations
2. Include clear documentation in your plugin directory
3. Follow the plugin structure conventions
4. Handle errors gracefully in your action handlers

## Troubleshooting

### Plugin Not Loading
- Ensure `plugin.json` exists and is valid JSON
- Check that the `main` file exists (defaults to `index.js`)
- Verify command names in `plugin.json` match action handlers

### Path Issues
- Use absolute paths if relative paths don't work
- Remember that relative paths are resolved from the current working directory
- Check that the plugin directory contains the required files

### Linking Issues
- Ensure the source directory exists and contains a valid plugin
- Use `storyblok plugins unlink <name>` before linking again
- Check symlink permissions on your system
