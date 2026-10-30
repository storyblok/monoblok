<div align="center">
  <a href="https://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=monoblok" align="center">
    <img src="https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png" alt="Storyblok Logo">
  </a>
  <h1 align="center">Monoblok</h1>
  <p align="center">
    A monorepo that consolidates all JavaScript projects from the Storyblok organization. This project aims to centralize the development, maintenance, and contribution to Storyblok's ecosystem of SDKs and tools.
  </p>
</div>

<p align="center">
  <a href="https://storyblok.com/join-discord">
    <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
  </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=monoblok">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-8d60ff?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## 📦 Packages

This monorepo contains the following official Storyblok SDKs and integrations:

### Core SDKs and API clients

| Package                                                  | Description                                      | Version                                                                                                                                                     | Downloads                                                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [@storyblok/js](packages/js)                             | Core JavaScript SDK                              | [![](https://img.shields.io/npm/v/@storyblok/js?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/js)                                       | [![](https://img.shields.io/npm/dm/@storyblok/js?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/js)                                       |
| [@storyblok/api-client](packages/capi-client)            | Content Delivery API client                      | [![](https://img.shields.io/npm/v/@storyblok/api-client?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/api-client)                       | [![](https://img.shields.io/npm/dm/@storyblok/api-client?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/api-client)                       |
| [@storyblok/management-api-client](packages/mapi-client) | Management API client                            | [![](https://img.shields.io/npm/v/@storyblok/management-api-client?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/management-api-client) | [![](https://img.shields.io/npm/dm/@storyblok/management-api-client?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/management-api-client) |
| [storyblok-js-client](packages/js-client)                | Universal JavaScript client for Storyblok's APIs | [![](https://img.shields.io/npm/v/storyblok-js-client?color=8d60ff&label=%20)](https://www.npmjs.com/package/storyblok-js-client)                           | [![](https://img.shields.io/npm/dm/storyblok-js-client?color=8d60ff&label=%20)](https://www.npmjs.com/package/storyblok-js-client)                           |
| [storyblok](packages/cli)                                | Storyblok CLI                                    | [![](https://img.shields.io/npm/v/storyblok?color=8d60ff&label=%20)](https://www.npmjs.com/package/storyblok)                                               | [![](https://img.shields.io/npm/dm/storyblok?color=8d60ff&label=%20)](https://www.npmjs.com/package/storyblok)                                               |
| [@storyblok/schema](packages/schema)                     | Schema types and helpers                         | [![](https://img.shields.io/npm/v/@storyblok/schema?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/schema)                               | [![](https://img.shields.io/npm/dm/@storyblok/schema?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/schema)                               |
| [@storyblok/migrations](packages/migrations)             | Migration utilities                              | [![](https://img.shields.io/npm/v/@storyblok/migrations?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/migrations)                       | [![](https://img.shields.io/npm/dm/@storyblok/migrations?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/migrations)                       |
| [@storyblok/region-helper](packages/region-helper)       | Helpers for Storyblok API regions                | [![](https://img.shields.io/npm/v/@storyblok/region-helper?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/region-helper)                 | [![](https://img.shields.io/npm/dm/@storyblok/region-helper?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/region-helper)                 |

### Framework integrations

| Package                                | Description         | Version                                                                                                                         | Downloads                                                                                                                        |
| -------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [@storyblok/react](packages/react)     | React SDK           | [![](https://img.shields.io/npm/v/@storyblok/react?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/react)     | [![](https://img.shields.io/npm/dm/@storyblok/react?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/react)     |
| [@storyblok/vue](packages/vue)         | Vue SDK             | [![](https://img.shields.io/npm/v/@storyblok/vue?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/vue)         | [![](https://img.shields.io/npm/dm/@storyblok/vue?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/vue)         |
| [@storyblok/nuxt](packages/nuxt)       | Nuxt module         | [![](https://img.shields.io/npm/v/@storyblok/nuxt?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/nuxt)       | [![](https://img.shields.io/npm/dm/@storyblok/nuxt?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/nuxt)       |
| [@storyblok/svelte](packages/svelte)   | Svelte SDK          | [![](https://img.shields.io/npm/v/@storyblok/svelte?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/svelte)   | [![](https://img.shields.io/npm/dm/@storyblok/svelte?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/svelte)   |
| [@storyblok/astro](packages/astro)     | Astro integration   | [![](https://img.shields.io/npm/v/@storyblok/astro?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/astro)     | [![](https://img.shields.io/npm/dm/@storyblok/astro?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/astro)     |
| [@storyblok/angular](packages/angular) | Angular integration | [![](https://img.shields.io/npm/v/@storyblok/angular?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/angular) | [![](https://img.shields.io/npm/dm/@storyblok/angular?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/angular) |

### Utilities

| Package                                                            | Description                                   | Version                                                                                                                                                     | Downloads                                                                                                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [@storyblok/richtext](packages/richtext)                           | Rich text renderer                            | [![](https://img.shields.io/npm/v/@storyblok/richtext?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/richtext)                           | [![](https://img.shields.io/npm/dm/@storyblok/richtext?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/richtext)                           |
| [@storyblok/live-preview](packages/live-preview)                   | Live preview integration                      | [![](https://img.shields.io/npm/v/@storyblok/live-preview?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/live-preview)                   | [![](https://img.shields.io/npm/dm/@storyblok/live-preview?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/live-preview)                   |
| [@storyblok/experiments](packages/experiments)                     | A/B testing utilities for the experiments API | [![](https://img.shields.io/npm/v/@storyblok/experiments?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/experiments)                     | [![](https://img.shields.io/npm/dm/@storyblok/experiments?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/experiments)                     |
| [@storyblok/accessibility-checker](packages/accessibility-checker) | Accessibility checks for the Visual Editor    | [![](https://img.shields.io/npm/v/@storyblok/accessibility-checker?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/accessibility-checker) | [![](https://img.shields.io/npm/dm/@storyblok/accessibility-checker?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/accessibility-checker) |
| [@storyblok/lint-config](packages/lint-config)                     | Shared Oxlint configuration                   | [![](https://img.shields.io/npm/v/@storyblok/lint-config?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/lint-config)                     | [![](https://img.shields.io/npm/dm/@storyblok/lint-config?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/lint-config)                     |

## 🛠️ Contributing

See the [Contributing Guide](CONTRIBUTING.md) for setup, commands, and commit conventions, and
[RELEASING.md](RELEASING.md) for the release process. The internal `monoblok` CLI in
[`tools/monoblok`](tools/monoblok) helps administer the repository.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
