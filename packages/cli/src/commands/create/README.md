# Create Command

The `create` command scaffolds a new project using Storyblok with your preferred technology stack. It automatically generates the project structure, creates a Storyblok space, configures environment variables, and opens your new space in the browser.

## Basic Usage

```bash
storyblok create [project-path]
```

This will start an interactive process where you can choose your technology stack and project path. The command will:
1. Scaffold a new project using your selected blueprint
2. Create a new Storyblok space for your project
3. Generate a `.env` file with your space's access token
4. Open your new space in the browser

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-b, --blueprint <blueprint>` | Technology starter blueprint (react, vue, svelte, astro, nuxt, next, eleventy) | Interactive selection |
| `--skip-space` | Skip space creation and only generate the project | `false` |

## Available Blueprints

| Blueprint | Technology |
|-----------|------------|
| `react` | React with TypeScript |
| `vue` | Vue 3 with TypeScript |
| `svelte` | SvelteKit with TypeScript |
| `astro` | Astro with TypeScript |
| `nuxt` | Nuxt 3 with TypeScript |
| `next` | Next.js with TypeScript |
| `eleventy` | Eleventy with JavaScript |

## Examples

1. **Interactive creation** (recommended for first-time users):
```bash
storyblok create
```
This will prompt you to:
- Select your preferred technology
- Choose a project path

2. **Create with a specific blueprint**:
```bash
storyblok create my-project --blueprint react
```

3. **Create without a Storyblok space** (project only):
```bash
storyblok create my-project --blueprint vue --skip-space
```

4. **Create with a custom path**:
```bash
storyblok create ./projects/my-awesome-app --blueprint astro
```

5. **Create with absolute path**:
```bash
storyblok create /Users/john/projects/my-app --blueprint eleventy
```

## Interactive Mode

When you don't specify a blueprint or project path, the CLI will guide you through the process:

### Blueprint Selection
```
? Please select the technology you would like to use: (Use arrow keys)
❯ React
  Vue 3
  Svelte
  Astro
  Nuxt 3
  Next.js
  Eleventy
```

### Project Path Input
```
? What is the path for your project? (./my-react-project)
```

The default project path will be `./my-{technology}-project` based on your blueprint selection.

## What Gets Created

### Project Structure
The command generates a complete project structure based on your chosen blueprint, including:
- Project scaffolding with the selected technology
- TypeScript configuration
- Storyblok integration setup
- Example components and pages
- Development server configuration

### Storyblok Space
Unless you use `--skip-space`, the command will:
- Create a new Storyblok space with your project name
- Configure the space with appropriate settings for your chosen technology
- Generate a preview token for local development

### Environment Configuration
The command automatically creates a `.env` file in your project root with:
```env
STORYBLOK_ACCESS_TOKEN=your_space_token_here
```

### Browser Integration
After successful creation, the command will:
- Open your new Storyblok space in your default browser
- Display the space management interface
- Show you next steps to get started

## Path Validation

The project path must meet these requirements:
- Cannot be empty
- Project name (last part of the path) can only contain letters, numbers, hyphens, and underscores
- Valid examples: `my-project`, `my_project_123`, `./projects/awesome-app`
- Invalid examples: `my project!`, `special@chars`, `project with spaces`

## Authentication

This command requires you to be logged in to Storyblok. If you're not authenticated, run:

```bash
storyblok login
```

## Error Handling

The command handles various error scenarios gracefully:

### Project Generation Failures
- Directory already exists and is not empty
- Permission issues when creating files
- Invalid project names or paths

### Space Creation Failures
- API connectivity issues
- Space name conflicts
- Insufficient permissions

### Environment Setup Issues
- `.env` file creation failures (shows manual token for fallback)
- Browser opening failures (provides manual space URL)

## Notes

- **Authentication Required**: You must be logged in before using this command
- **Directory Check**: The command will warn you if the target directory already exists and is not empty
- **Space Names**: Spaces are created with human-readable names (e.g., "my-project" becomes "My Project")
- **Region Support**: The space will be created in the same region as your logged-in account
- **Technology Validation**: Invalid blueprint names will trigger interactive selection
- **Graceful Degradation**: If space creation fails, you'll still have your project files
- **Manual Fallbacks**: If automated steps fail (like opening browser), manual instructions are provided

## Troubleshooting

### "Invalid blueprint" Warning
If you specify an invalid blueprint name, the CLI will show available options and switch to interactive mode:
```bash
storyblok create my-project --blueprint invalid-name
# ⚠ Invalid blueprint "invalid-name". Valid options are: react, vue, svelte, astro, nuxt, next, eleventy
```

### Directory Already Exists
If the target directory exists and is not empty, the command will show an error and stop execution to prevent overwriting existing files.

### Permission Issues
If you encounter permission errors:
- Ensure you have write access to the target directory
- Check that your Storyblok account has space creation permissions
- Verify your authentication token is still valid

### Failed to Open Browser
If the browser fails to open automatically, the CLI will provide the direct URL to your space:
```
⚠ Failed to open browser: [error message]
ℹ You can manually open your space at: https://app.storyblok.com/#/me/spaces/12345/dashboard
```

## Next Steps

After creating your project:

1. **Navigate to your project**:
```bash
cd your-project-name
```

2. **Install dependencies**:
```bash
npm install
```

3. **Start development server**:
```bash
npm run dev
```

4. **Open your Storyblok space** (if not opened automatically) and start creating content!
