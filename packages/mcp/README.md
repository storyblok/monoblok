<div align="center">

![Storyblok ImagoType](https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png)

<h1 align="center">@storyblok/mcp</h1>
  <p>
    Storyblok MCP servers, ready to plug into IDE agents and MCP-compatible tools.
  </p>
  <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/mcp">
    <img src="https://img.shields.io/npm/v/@storyblok/mcp/latest.svg?style=flat-square&color=8d60ff" alt="Storyblok MCP" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/mcp" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/mcp.svg?style=appveyor&color=8d60ff" alt="npm">
  </a>
  <a href="https://storyblok.com/join-discord">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a><br/>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=@storyblok/mcp">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-8d60ff?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## Features

- 🔌 **MCP Native** - Starts standalone MCP servers over stdio for agent integration
- 🧰 **Management API Coverage** - Dedicated servers for core MAPI resources
- 🧠 **Skill Files** - Optional skills to improve agent tool selection
- 🧭 **Space-Aware** - Optional space scoping via environment variables
- ⚙️ **Tooling Friendly** - Simple `npx` commands for quick setup in any project

## Pre-requisites

- [Node.js >= 18.0.0](https://nodejs.org/en/download/)
- Storyblok account (sign up [here](https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=@storyblok/mcp))
- Personal access token from Storyblok (get it [here](https://app.storyblok.com/#/me/account?tab=token))

## Running an MCP server

Each command below starts a standalone MCP server on stdio:

```bash
npx -y @storyblok/mcp mapi-stories
```

**Available commands:**

- `npx -y @storyblok/mcp mapi-asset-folders`
- `npx -y @storyblok/mcp mapi-assets`
- `npx -y @storyblok/mcp mapi-component-folders`
- `npx -y @storyblok/mcp mapi-components`
- `npx -y @storyblok/mcp mapi-datasource-entries`
- `npx -y @storyblok/mcp mapi-datasources`
- `npx -y @storyblok/mcp mapi-internal-tags`
- `npx -y @storyblok/mcp mapi-presets`
- `npx -y @storyblok/mcp mapi-spaces`
- `npx -y @storyblok/mcp mapi-stories`
- `npx -y @storyblok/mcp mapi-users`

## Configuration

### Claude Code

Add an MCP server entry to your Claude Code config (for example, `.claude/claude.json`):

```json
{
  "mcpServers": {
    "storyblok-mapi-stories": {
      "command": "npx",
      "args": ["-y", "@storyblok/mcp", "mapi-stories"],
      "env": {
        "STORYBLOK_MCP_AUTH_TOKEN": "<your-token>",
        "STORYBLOK_MCP_SPACE": "<optional-space-id>"
      }
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json` in your project and add an MCP server entry:

```json
{
  "mcpServers": {
    "storyblok-mapi-stories": {
      "command": "npx",
      "args": ["-y", "@storyblok/mcp", "mapi-stories"],
      "env": {
        "STORYBLOK_MCP_AUTH_TOKEN": "<your-token>",
        "STORYBLOK_MCP_SPACE": "<optional-space-id>"
      }
    }
  }
}
```

## Skills (optional)

For more reliable results, copy the skills for the MCP servers you've added into your project:

```bash
npx -y @storyblok/mcp copy-skill mapi-stories
```

This copies skills into `.claude/skills` in the current directory. To target a different folder, pass a path as the second argument.

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

- [Discuss Storyblok on Github Discussions](https://github.com/storyblok/monoblok/discussions)

For community support, chatting with other users, please visit:

- [Discuss Storyblok on Discord](https://storyblok.com/join-discord)

## Support

For bugs or feature requests, please [submit an issue](https://github.com/storyblok/monoblok/issues/new/choose).

> [!IMPORTANT]
> Please search existing issues before submitting a new one. Issues without a minimal reproducible example will be closed. [Why reproductions are Required](https://antfu.me/posts/why-reproductions-are-required).

### I can't share my company project code

We understand that you might not be able to share your company's project code. Please provide a minimal reproducible example that demonstrates the issue by using tools like [Stackblitz](https://stackblitz.com) or a link to a Github Repo lease make sure you include a README file with the instructions to build and run the project, important not to include any access token, password or personal information of any kind.

### Feedback

If you have a question, please ask in the [Discuss Storyblok on Discord](https://storyblok.com/join-discord) channel.

## Contributing

If you'd like to contribute, please refer to the [contributing guidelines](CONTRIBUTING.md).

## License

[License](/LICENSE)
