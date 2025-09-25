# Storyblok CLI Plugin System

Extend the Storyblok CLI with custom commands and functionality. The plugin system follows convention-over-configuration principles, making it simple to create powerful extensions.

## 🚀 Quick Start

```bash
# Install a plugin
storyblok plugins install ./my-awesome-plugin

# Use the plugin
storyblok my-awesome-plugin hello --name "World"

# Link for development (changes reflect immediately)
storyblok plugins link ./my-awesome-plugin
```

## ✨ Key Features

- **📝 Simple Configuration**: Define the plugin within `package.json` or in a separate `plugin.json`
- **🔄 Development Mode**: Live reloading with symlinks
- **🪝 Hooks System**: Lifecycle and custom hooks
- **🔌 Inter-plugin Communication**: Plugins can interact with each other
- **🌐 CLI Context access**: Plugins have access to the CLI utils, commands, mapiClient, etc

## 📋 Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `storyblok plugins install <path>` | Install plugin (copies files) | Production use |
| `storyblok plugins link <path>` | Link plugin (symlink) | Development |
| `storyblok plugins unlink <name>` | Unlink a plugin | Stop development |
| `storyblok plugins uninstall <name>` | Remove plugin completely | Cleanup |
| `storyblok plugins list` | Show all plugins | Check status |

### 🛠️ Development Workflow

```bash
# 1. Link your plugin for development
storyblok plugins link ./my-plugin

# 2. Make changes to your code (auto-reflected)
# 3. Test your changes
storyblok my-plugin hello --name "Test"

# 4. When ready, install for production
storyblok plugins unlink my-plugin
storyblok plugins install ./my-plugin
```

> **💡 Tip**: All commands support relative (`./plugin`) and absolute (`/path/to/plugin`) paths

## 📁 Plugin Structure

In essence, a plugin is a minimal npm package with extra configuration provided in its **manifest**.

```
my-plugin/
├── package.json         # 📦 Manifest within "storyblok" key, or in a separated `plugin.json`
└── index.js            # 🚀 Main plugin code
```

## 📝 Plugin manifest

### package.json
```json
{
  "name": "my-storyblok-plugin",
  "version": "1.0.0",
  "main": "index.js",
  "storyblok": {
    "name": "my-plugin",
    "commands": [
      {
        "name": "hello",
        "description": "Say hello command",
        "aliases": ["hi", "greet"],
        "options": [
          {
            "flags": "-n, --name <name>",
            "description": "Your name"
          }
        ]
      }
    ],
    "hooks": ["my-custom-hook"]
  }
}
```

### plugin.json (Alternative)
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "commands": [
    {
      "name": "hello",
      "description": "Say hello command",
      "aliases": ["hi", "greet"],
      "options": [
        {
          "flags": "-n, --name <name>",
          "description": "Your name"
        }
      ]
    }
  ],
  "hooks": ["my-custom-hook"]
}
```

## 💻 Implementation

### Basic Plugin
```javascript
export default function createPlugin(context) {
  const { logger, mapiClient, runCommand, runHook } = context;

  return {
    // 🎯 Command actions (match names in manifest)
    actions: {
      hello: async (options) => {
        logger.info(`Hello, ${options.name || 'World'}!`);

        // 🌐 Access Storyblok API
        const components = await mapiClient.get('spaces/12345/components');

        // 🔗 Run other CLI commands
        await runCommand('pull-components');

        // 🔥 Trigger custom hooks
        await runHook('my-custom-hook', { data: options });
      }
    },

    // 🪝 Listen to hooks
    hooks: {
      init: async () => logger.info('Plugin initialized'),
      preRun: async () => logger.info('Command starting'),
      postRun: async ({ success, error }) => {
        if (success) {
          logger.info('✅ Success');
        }
        else {
          logger.warn('❌ Failed:', error?.message);
        }
      },
      'my-custom-hook': async () => {
        // ...
      }
    }
  };
}
```

### Plugin Context API

| Property | Description | Example |
|----------|-------------|---------|
| `logger` | Console logger (konsola) | `logger.info('Hello')` |
| `mapiClient` | Storyblok Management API | `await mapiClient.get('spaces/123/components')` |
| `runCommand` | Execute CLI commands | `await runCommand('pull-components')` |
| `getPlugin` | Access other plugins | `getPlugin('other-plugin')` |
| `runHook` | Trigger custom hooks | `await runHook('deploy', { env: 'prod' })` |
| `session` | Current CLI session | Access tokens, config |
| `utils` | CLI utility functions | File operations, etc. |

## 📊 Plugin Types

| Type | Storage | Use Case | Command |
|------|---------|----------|---------|
| **Installed** 📦 | Copied to `~/.storyblok/plugins/` | Production, stable | `install` |
| **Linked** 🔗 | Symlinked to source | Development, live changes | `link` |

> Use `storyblok plugins list` to see all plugins and their status

## 🪝 Hooks System

Extend plugin functionality with lifecycle and custom hooks.

### Lifecycle Hooks (Built-in)

**No declaration needed** - implement only what you need:

| Hook | When | Context |
|------|------|---------|
| `init` | CLI startup | Basic context |
| `preRun` | Before command | Command args |
| `postRun` | After command | Success/error status |

```javascript
// Example implementation in plugin
export default function createPlugin(context) {
  return {
    actions: {
      // ...
    },
    hooks: {
      init: async () => {
        logger.info('🚀 Plugin ready');
      },
      preRun: async ({ args }) => {
        logger.info('Running:', args[0]);
      },
      postRun: async ({ success, error }) => {
        if (success) {
          logger.info('✅ Done');
        }
        else {
          logger.error('❌ Error:', error?.message);
        }
      }
    }
  };
}
```

### Custom Hooks

**Must be declared** in manifest for inter-plugin communication:

```json
{
  "name": "deploy-plugin",
  "hooks": ["before-deploy", "after-deploy", "rollback"]
}
```

```javascript
// Implement custom hooks in plugin
export default function createPlugin(context) {
  const { logger, runHook } = context;

  return {
    hooks: {
      'before-deploy': async ({ environment, version }) => {
        logger.info(`🚀 Deploying ${version} to ${environment}`);
        // Pre-deployment logic
      },
      'after-deploy': async ({ success, environment }) => {
        if (success) {
          logger.info(`✅ Deployed to ${environment}`);
        }
      }
    },

    // Trigger from other plugins
    actions: {
      deploy: async (options) => {
        await runHook('before-deploy', {
          environment: options.env,
          version: '1.2.3'
        });

        // Deployment logic...

        await runHook('after-deploy', {
          success: true,
          environment: options.env
        });
      }
    }
  };
}
```

## 📚 Examples & Resources

### Quick Examples

#### Simple Hello Plugin
```javascript
// plugin.json: { "name": "hello", "commands": [{"name": "greet"}] }
export default function createPlugin({ logger }) {
  return {
    actions: {
      greet: async ({ name = 'World' }) => {
        logger.info(`Hello, ${name}!`);
      }
    }
  };
}
```

#### API Integration Plugin
```javascript
export default function createPlugin({ mapiClient, logger }) {
  return {
    actions: {
      'list-spaces': async () => {
        const spaces = await mapiClient.get('spaces');
        spaces.forEach(space => logger.info(`• ${space.name}`));
      }
    }
  };
}
```

### Sample Plugins
- [examples/sample-plugin](../../../examples/sample-plugin/) - Basic plugin
- [examples/wp-to-storyblok-plugin](../../../examples/wp-to-storyblok-plugin/) - Advanced multi-command plugin

## 🔧 Best Practices

### Development ✅
- Use `link` command for active development
- Keep plugins in version control
- Test with different path formats
- Use TypeScript for better DX

### Production ✅
- Use `install` command for stable deployments
- Include comprehensive README
- Handle errors gracefully
- Follow semantic versioning

### Architecture ✅
- Keep actions focused and single-purpose
- Use hooks for cross-cutting concerns
- Leverage context APIs instead of imports
- Document custom hooks for other plugins

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Plugin not found | Check `plugin.json` exists or `package.json` has `storyblok` key |
| Command not working | Verify action name matches command name in manifest |
| Path resolution fails | Try absolute paths, check file permissions |
| Link not updating | Unlink first, then re-link: `unlink plugin-name && link ./path` |
| Hook not triggering | Ensure custom hooks are declared in manifest |

> **💡 Pro Tip**: Use `storyblok plugins list` to debug plugin status and paths
