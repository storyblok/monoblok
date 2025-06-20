<div align="center">

![Storyblok ImagoType](https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png)

<h1>Storyblok CLI</h1>
  <p>A powerful CLI tool to improve the DX of your <a href="https://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok" target="_blank">Storyblok</a> projects.</p>
  <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/storyblok">
    <img src="https://img.shields.io/npm/v/storyblok/latest.svg?style=flat-square&color=8d60ff" alt="Storyblok JS Client" />
  </a>
  <a href="https://npmjs.com/package/storyblok" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/storyblok.svg?style=appveyor&color=8d60ff" alt="npm">
  </a>
  <a href="https://storyblok.com/join-discord">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a><br/>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-cli">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-8d60ff?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## Features

- 🛡️ **Type Safety** - Generate TypeScript type definitions for your Storyblok components, ensuring type safety in your frontend applications
- 🔐 **Authentication** - Secure login system with support for different regions and CI environments
- 🧩 **Component Management** - Pull and push component schemas, groups, presets, and internal tags between spaces
- 🔄 **Migration System** - Generate and run migrations to transform or update field values across your Storyblok content
- 🌐 **Language Management** - Pull and manage languages for your Storyblok space
- 📁 **File Organization** - Organized file structure with the `.storyblok` directory as default
- 🛠️ **Customizable Paths** - Flexible path configuration for all generated files
- 📝 **Naming Conventions** - Consistent file naming with customizable suffixes and prefixes
- 📂 **Separate Files Support** - Option to work with individual component files or consolidated files
- 👀 **Dry Run Mode** - Preview migrations changes before applying them to your Storyblok space
- 🔍 **Filtering Capabilities** - Filter components and stories using glob patterns and Storyblok query syntax
- 📊 **Verbose Logging** - Improved error handling and detailed logging options for debugging and monitoring

## Pre-requisites

- [Node.js >= 18.0.0](https://nodejs.org/en/download/)
- Storyblok account (sign up [here](https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-cli))
- Personal access token from Storyblok (get it [here](https://app.storyblok.com/#/me/account?tab=token))

## Documentation

> [!WARNING]
> Official documentation for this package v4 is still in development. In the meantime, please refer to the internal documentation for the [v4 beta](src/README.md).

## Setup

This package relies on [pnpm](https://pnpm.io/) to manage dependencies. For instructions on how to install pnpm, please visit [pnpm.io](https://pnpm.io/installation).

```bash
pnpm install
```

## Build

```bash
pnpm build
```

### Testing

To run the tests you can use the following command:

```bash
pnpm run test
```

If you prefer a more visual experience while writing tests you can use this command powered by [vitest/ui](https://vitest.dev/guide/ui):

```bash
pnpm run test:ui
```

You can also check the coverage with:

```bash
pnpm run coverage
```

### Debugging

To debug the CLI you can use the `launch.json` configuration in the `.vscode` folder. You can run any command with the debugger attached.

![A screenshot of the Visual Studio Code debugger](/.github/assets/debug-vscode.png)

Then you can set breakpoints directly to the typescript files and the debugger will handle the rest with sourcempaps.

![A screenshot of a breakpoint set in the Visual Studio Code debugger](/.github/assets/breakpoints.png)

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

- [Discuss Storyblok on Github Discussions](https://github.com/storyblok/storyblok/discussions)

For community support, chatting with other users, please visit:

- [Discuss Storyblok on Discord](https://storyblok.com/join-discord)

## Support

For bugs or feature requests, please [submit an issue](https://github.com/storyblok/storyblok-cli/issues/new/choose).

> [!IMPORTANT]
> Please search existing issues before submitting a new one. Issues without a minimal reproducible example will be closed. [Why reproductions are Required](https://antfu.me/posts/why-reproductions-are-required).

### I can't share my company project code

We understand that you might not be able to share your company's project code. Please provide a minimal reproducible example that demonstrates the issue by using tools like [Stackblitz](https://stackblitz.com) or a link to a Github Repo lease make sure you include a README file with the instructions to build and run the project, important not to include any access token, password or personal information of any kind.

### I only have a question

If you have a question, please ask in the [Discuss Storyblok on Discord](https://storyblok.com/join-discord) channel.

## Contributing

If you're interested in contributing to Storyblok CLI, please read our [contributing docs](https://github.com/storyblok/.github/blob/main/contributing.md) before submitting a pull request.

## License

[License](/LICENSE)
