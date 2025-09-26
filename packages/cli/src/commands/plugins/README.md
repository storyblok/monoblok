# Storyblok CLI Plugin System

Extend the Storyblok CLI with custom commands and functionality. The plugin system follows convention-over-configuration principles, making it simple to create powerful extensions.

## 🚀 Quick Start your own Plugin

```bash
# Create a new plugin (interactive prompts)
storyblok plugins create

# Link for developm             logger.info(`📊 Space: ${spaceData.name}`);
          logger.info(`🌍 Default locale: ${spaceData.default_locale}`);
          logger.info(`🎨 Components: ${components.length}`);
          logger.info(`📅 Created: ${new Date(spaceData.created_at).toLocaleDateString()}`);   logger.info(`📊 Space: ${spaceData.name}`);
          logger.info(`🌍 Default locale: ${spaceData.default_locale}`);
          logger.info(`🎨 Components: ${components.length}`);
          logger.info(`📅 Created: ${new Date(spaceData.created_at).toLocaleDateString()}`);(changes reflect immediately)
storyblok plugins link ./my-plugin

# Use it
storyblok my-plugin hello --name "Test"
```

## 🕹️ Installing Plugins

Install plugins from different sources:

```bash
# From npm package
storyblok plugins install my-storyblok-plugin

# From GitHub repository
storyblok plugins install user/repo

# From local path
storyblok plugins install ./path/to/plugin

# Use the installed plugin
storyblok my-plugin hello --name "World"
```

## ✨ Key Features

- **📝 Simple Configuration**: Define the plugin within `package.json` or in a separate `plugin.json`
- **🔄 Development Mode**: Live reloading with symlinks
- **🪝 Hooks System**: Lifecycle and custom hooks
- **🔌 Inter-plugin Communication**: Plugins can interact with each other
- **🌐 Context API**: Access to Management API, CLI commands and utils, and inter-plugin communication

## 📋 Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `storyblok plugins create [name]` | Create new plugin with template | Start development |
| `storyblok plugins install <path>` | Install plugin (copies files) | Production use |
| `storyblok plugins link <path>` | Link plugin (symlink) | Development |
| `storyblok plugins unlink <name>` | Unlink a plugin | Stop development |
| `storyblok plugins uninstall <name>` | Remove plugin completely | Cleanup |
| `storyblok plugins list` | Show all plugins | Check status |

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
    "hooks": ["my-plugin:custom-hook", "my-plugin:before-deploy"]
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
  "hooks": ["my-plugin:custom-hook", "my-plugin:before-deploy"]
}
```

## 💻 Implementation

### Basic Plugin
```javascript
export default function createPlugin(context) {
  const { logger, mapiClient, utils, runCommand, getPlugin, runHook } = context;

  return {
    // 🎯 Command actions (match names in manifest)
    actions: {
      hello: async (options) => {
        logger.info(`Hello, ${options.name || 'World'}!`);

        // 🌐 Access Storyblok Management API
        const components = await mapiClient.get('spaces/12345/components');
        logger.info(`Found ${components.length} components`);

        // 🛠️ Use utility functions
        const configPath = utils.getStoryblokGlobalPath();
        logger.info(`Config directory: ${configPath}`);

        // 🔗 Run other CLI commands
        await runCommand('components', ['pull']);

        // 🔌 Access other plugins and run their commands
        const deployPlugin = getPlugin('deploy-plugin');
        if (deployPlugin && deployPlugin.actions.deploy) {
          await deployPlugin.actions.deploy({ env: 'staging' });
          logger.info('Deploy plugin command executed');
        }

        // 🔥 Trigger custom hooks (prefix by <plugin name>: for best practice)
        await runHook('my-plugin:custom-hook', { data: options });
      }
    },

    // 🪝 Listen to hooks
    hooks: {
      'init': async () => logger.info('Plugin initialized'),
      'before-command': async ({ args }) => logger.info('Command starting:', args[0]),
      'after-command': async ({ args }) => logger.info('✅ Command completed:', args[0]),
      'on-error': async ({ error, args }) => logger.error('❌ Command failed:', args[0], error?.message),
      'teardown': async ({ error }) => {
        if (error) {
          logger.info('🧹 Cleanup after error');
        }
        else {
          logger.info('🧹 Normal cleanup');
        }
      },
      'my-plugin:custom-hook': async (context) => {
        logger.info('Custom hook triggered:', context);
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
| `utils` | CLI utility functions | `utils.getStoryblokGlobalPath()` |
| `runCommand` | Execute CLI commands | `await runCommand('components', ['pull'])` |
| `getPlugin` | Access other loaded plugins | `getPlugin('other-plugin-name')` |
| `runHook` | Trigger custom hooks | `await runHook('deploy', { env: 'prod' })` |

## 🪝 Hooks System

Extend plugin functionality with lifecycle and custom hooks.

### Lifecycle Hooks (Built-in)

**No declaration needed** - implement only what you need:

| Hook | When | Context |
|------|------|---------|
| `init` | CLI startup | Basic context |
| `before-command` | Before command | Command args |
| `after-command` | After successful command | Command args |
| `on-error` | When command fails | Error + command args |
| `teardown` | CLI shutdown/cleanup | Error (if any) + command args |

```javascript
// Example implementation in plugin
export default function createPlugin(context) {
  const { logger } = context;

  return {
    actions: {
      // ...
    },
    hooks: {
      'init': async () => {
        logger.info('🚀 Plugin ready');
      },
      'before-command': async ({ args }) => {
        logger.info('Running:', args[0]);
      },
      'after-command': async ({ args }) => {
        logger.info('✅ Command completed:', args[0]);
      },
      'on-error': async ({ error, args }) => {
        logger.error('❌ Command failed:', args[0], error?.message);
      },
      'teardown': async ({ error }) => {
        if (error) {
          logger.info('🧹 Plugin cleanup after error');
        }
        else {
          logger.info('🧹 Plugin normal cleanup');
        }
      }
    }
  };
}
```

### Custom Hooks

**Must be declared** in manifest for inter-plugin communication.

> **💡 Best Practice**: Use hyphen-case for custom hooks and prefix with plugin name (e.g., `deploy-plugin:before-deploy`)

```json
{
  "name": "deploy-plugin",
  "hooks": ["deploy-plugin:before-deploy", "deploy-plugin:after-deploy", "deploy-plugin:rollback"]
}
```

```javascript
// Implement custom hooks in plugin
export default function createPlugin(context) {
  const { logger, runHook } = context;

  return {
    hooks: {
      'deploy-plugin:before-deploy': async ({ environment, version }) => {
        logger.info(`🚀 Deploying ${version} to ${environment}`);
        // Pre-deployment logic
      },
      'deploy-plugin:after-deploy': async ({ success, environment }) => {
        if (success) {
          logger.info(`✅ Deployed to ${environment}`);
        }
      }
    },

    // Trigger from other plugins
    actions: {
      deploy: async (options) => {
        await runHook('deploy-plugin:before-deploy', {
          environment: options.env,
          version: '1.2.3'
        });

        // Deployment logic...

        await runHook('deploy-plugin:after-deploy', {
          success: true,
          environment: options.env
        });
      }
    }
  };
}
```

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

## 📊 Plugin Installation types

| Type | Storage | Use Case | Command |
|------|---------|----------|---------|
| **Installed** 📦 | Copied to `~/.storyblok/plugins/` | Production, stable | `install` |
| **Linked** 🔗 | Symlinked to source | Development, live changes | `link` |

> Use `storyblok plugins list` to see all plugins and their status

## 🍳 Recipes

Real-world plugin examples for common Storyblok workflows.

### 1. Minimal Plugin
A simple "hello world" to get started:

```javascript
// package.json: { "storyblok": { "name": "hello", "commands": [{"name": "greet"}] } }
export default function createPlugin({ logger }) {
  return {
    actions: {
      greet: async (options) => {
        const name = options.name || 'World';
        logger.info(`👋 Hello, ${name}!`);
      }
    }
  };
}
```

### 2. Space Info Plugin

Display basic space information and stats:

```javascript
// package.json: { "storyblok": { "name": "space-info", "commands": [{"name": "info"}] } }
export default function createPlugin({ mapiClient, logger }) {
  return {
    actions: {
      info: async ({ space }) => {
        try {
          const spaceData = await mapiClient.get(`spaces/${space}`);
          const components = await mapiClient.get(`spaces/${space}/components`);

          logger.info(`📊 Space: ${spaceData.name}`);
          logger.info(`🌍 Default locale: ${spaceData.default_locale}`);
          logger.info(`🎨 Components: ${components.length}`);
          logger.info(`� Created: ${new Date(spaceData.created_at).toLocaleDateString()}`);
        }
        catch (error) {
          logger.error('Failed to fetch space info:', error.message);
        }
      }
    }
  };
}
```

### 3. SEO Story Checker Plugin
Check if a story has proper SEO fields filled out:

```javascript
// package.json: { "storyblok": { "name": "seo-checker", "commands": [{"name": "check-seo"}] } }
export default function createPlugin({ mapiClient, logger }) {
  return {
    actions: {
      'check-seo': async ({ space, slug = 'home' }) => {
        try {
          const story = await mapiClient.get(`spaces/${space}/stories`, {
            params: { with_slug: slug }
          });

          if (!story.stories || story.stories.length === 0) {
            logger.warn(`❌ No story found with slug: ${slug}`);
            return;
          }

          const storyData = story.stories[0];
          logger.info(`🔍 SEO Check for: ${storyData.name} (${storyData.full_slug})`);

          const content = storyData.content;
          let seoScore = 0;
          let totalChecks = 0;

          // Check for SEO title
          totalChecks++;
          if (content.seo_title && content.seo_title.trim()) {
            logger.info(`✅ SEO Title: "${content.seo_title}"`);
            seoScore++;
          }
          else {
            logger.warn(`❌ SEO Title: Missing or empty`);
          }

          // Check for SEO description
          totalChecks++;
          if (content.seo_description && content.seo_description.trim()) {
            logger.info(`✅ SEO Description: "${content.seo_description.substring(0, 50)}..."`);
            seoScore++;
          }
          else {
            logger.warn(`❌ SEO Description: Missing or empty`);
          }

          // Check for og:image
          totalChecks++;
          if (content.og_image && content.og_image.filename) {
            logger.info(`✅ OG Image: ${content.og_image.filename}`);
            seoScore++;
          }
          else {
            logger.warn(`❌ OG Image: Missing`);
          }

          // SEO Score
          const scorePercent = Math.round((seoScore / totalChecks) * 100);
          if (scorePercent === 100) {
            logger.info(`🎉 SEO Score: ${scorePercent}% - Perfect!`);
          }
          else if (scorePercent >= 66) {
            logger.warn(`⚠️ SEO Score: ${scorePercent}% - Good but could be better`);
          }
          else {
            logger.error(`💥 SEO Score: ${scorePercent}% - Needs attention!`);
          }
        }
        catch (error) {
          logger.error(`Failed to check SEO: ${error.message}`);
        }
      }
    }
  };
}
```

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
