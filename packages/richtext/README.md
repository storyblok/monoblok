![](/.github/repo-banner.png)

<div align="center">
  <h1>@storyblok/richtext</h1>
  <p>
    A custom resolver for the Storyblok Richtext field.
  </p>
  <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/richtext">
    <img src="https://img.shields.io/npm/v/@storyblok/richtext/latest.svg?style=flat-square" alt="Storyblok JS" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/richtext" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/richtext.svg?style=flat-square" alt="npm">
  </a>
</p>

<p align="center">
  <a href="https://discord.gg/jKrbAMz">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=09b3af">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-09b3af?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-richtext">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-09b3af?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## 🚀 Usage

> If you are first-time user of the Storyblok, read the [Getting Started](https://www.storyblok.com/docs/guide/getting-started?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-richtext) guide to get a project ready in less than 5 minutes.

### Installation

```bash
npm install @storyblok/richtext
```

or `yarn`:

```bash
yarn add @storyblok/richtext
```

or `pnpm`:

```bash
pnpm add @storyblok/richtext
```

### Basic

```ts
import { richTextResolver } from '@storyblok/richtext';

const { render } = richTextResolver();

const html = render(doc);

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
  ${html}
  </div>
`;
```

### Overwrite resolvers

To overwrite an existing resolver, you can pass a property called resolvers available on the `richTextResolver` options.

```ts
import { MarkTypes, richTextResolver } from '@storyblok/richtext';

const html = richTextResolver({
  resolvers: {
    [MarkTypes.LINK]: (node) => {
      return `<button href="${node.attrs?.href}" target="${node.attrs?.target}">${node.children}</button>`;
    },
  },
}).render(doc);
```

### Framework usage

The `@storyblok/richtext` package is framework-agnostic and can be used with any frontend framework. Below are examples of how to use the package with different frameworks:

### Vue

> [!TIP]
> For a better developer experience, use the correspondant APIs available in the framework SDK. Example `StoryblokRichtText` component in `@storyblok/vue`. See more [here](https://github.com/storyblok/storyblok-vue?tab=readme-ov-file#rendering-rich-text).

```html
<script setup>
  import type { VNode } from 'vue';
  import { createTextVNode, h } from 'vue';
  import { BlockTypes, richTextResolver, type StoryblokRichTextNode, type StoryblokRichTextOptions } from '@storyblok/richtext';

  const options: StoryblokRichTextOptions<VNode> = {
    renderFn: h,
    textFn: createTextVNode,
    keyedResolvers: true,
  };

  const root = () => richTextResolver<VNode>(options).render(doc);
</script>

<template>
  <root />
</template>
```

### React

> [!TIP]
> For a better developer experience, use the correspondant APIs available in the framework SDK.  `StoryblokRichtText` component in `@storyblok/react` will be available [soon](https://github.com/storyblok/storyblok-react/pull/1243/files).

```tsx
import React from 'react';
import { richTextResolver } from '@storyblok/richtext';

const options: StoryblokRichTextOptions<ReactElement> = {
  renderFn: React.createElement,
  keyedResolvers: true,
};

const html = richTextResolver(
  options,
).render(doc);

// Convert attributes in element to JSX. Refer to the `convertAttributesInElement` function in the playground/react
const formattedHtml = convertAttributesInElement(html);

return (
  <>
    {formattedHtml}
  </>
);
```

Refer to the [playground/react](/playground/react) for the complete example.

### Typing with Generics

It is possible to ensure correct typing support in a framework-agnostic way by using [Typescript Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)

- Vanilla `string`
- Vue `VNode`
- React `React.ReactElement`

This way the `@storyblok/richtext` is ignorant of framework specific types, avoiding having to import them and having `vue` `react` etc as dependencies.

```ts
// Vanilla
const options: StoryblokRichTextOptions<string> = {
  resolvers: {
    [MarkTypes.LINK]: (node: Node<string>) => {
      return `<button href="${node.attrs?.href}" target="${node.attrs?.target}">${node.children}</button>`;
    },
  },
};

const html = richTextResolver<string>(options).render(doc);
```

```ts
// Vue
const options: StoryblokRichTextOptions<VNode> = {
  renderFn: h,
  keyedResolvers: true,
};
const root = () => richTextResolver<VNode>(options).render(doc);
```

```ts
// React
const options: StoryblokRichTextOptions<React.ReactElement> = {
  renderFn: React.createElement,
  keyedResolvers: true,
};
const root = () => richTextResolver<React.ReactElement>(options).render(doc);
```

## Optimize Images

To optimize images in the richtext, you can use the `optimizeImages` property on the `richTextResolver` options. For the full list of available options, check the [Image Optimization](https://github.com/storyblok/storyblok-js-client?tab=readme-ov-file#method-storyblokrichtextresolverrender) documentation.

```ts
import { richTextResolver } from '@storyblok/richtext';

const html = richTextResolver({
  optimizeImages: {
    class: 'my-peformant-image',
    loading: 'lazy',
    width: 800,
    height: 600,
    srcset: [400, 800, 1200, 1600],
    sizes: ['(max-width: 400px) 100vw', '50vw'],
    filters: {
      format: 'webp',
      quality: 10,
      grayscale: true,
      blur: 10,
      brightness: 10,
    },
  },
}).render(doc);
```

## Security: HTML Output Sanitization

> [!WARNING]
> This package does not provide proper HTML sanitization by default

The `@storyblok/richtext` package primarly converts rich text content into HTML strings, which can then be rendered into the DOM of a web page. This means that any HTML output generated by the rich text resolver includes the raw content as it is defined in Storyblok, which may potentially include harmful or malicious scripts.

### Why is Sanitization Important?

Injecting unsanitized HTML into your web application can expose it to cross-site scripting (XSS) attacks. XSS attacks can allow attackers to execute malicious scripts in the context of your website, potentially leading to data theft, session hijacking, and other security breaches.

### Your Responsibility

As a developer using `@storyblok/richtext`, you are responsible for sanitizing the HTML output from the rich text resolver before injecting it into the DOM. This precaution helps prevent XSS attacks and ensures a safer web environment for your users.

### Recommended Sanitization Libraries

To assist you in sanitizing HTML content, we recommend using the following library:

- **sanitize-html**: A simple HTML sanitizer with a flexible API that can adjust to a wide range of applications.

  GitHub: [sanitize-html](https://github.com/apostrophecms/sanitize-html)

### Example Usage

Here is an example of how you might sanitize HTML output using `sanitize-html` before rendering it to the DOM:

```javascript
import sanitizeHtml from 'sanitize-html';
import { richTextResolver } from '@storyblok/richtext';

const html = richTextResolver().render(yourRichTextContent);
const sanitizedHTML = sanitizeHtml(html, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title']
  }
});

document.getElementById('your-element-id').innerHTML = sanitizedHTML;
```

## Setup

```
pnpm install
```

This command will install the dependencies for the workspace, including the dependencies for the playgrounds under `/playground` and different framework wrappers `/packages`

### Run Playground

To run the vanilla Typescript playground:

```bash
pnpm run playground
```

Vue playground:

```bash
pnpm run playground:vue
```

React playground:

```bash
pnpm run playground:react
```

Alternatively you can run the following command to run all the playgrounds:

```bash
pnpm run playground:all
```

### Build

To build the core package:

```bash
pnpm run build
```

To build the wrappers under `/packages`:

```bash
pnpm run build:packages
```

### Lint

To lint the core package:

```bash
pnpm run lint
```

To lint the wrappers under `/packages`:

```bash
pnpm run lint:packages
```

Alternatively, you can run the following command to fix the linting issues:

```bash
pnpm run lint:fix
```

### Test

To run the tests for the core package:

```bash
pnpm run test
```

## 🔗 Related Links

- **[Storyblok Technology Hub](https://www.storyblok.com/technologies?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js)**: Storyblok integrates with every framework so that you are free to choose the best fit for your project. We prepared the technology hub so that you can find selected beginner tutorials, videos, boilerplates, and even cheatsheets all in one place.
- **[Getting Started](https://www.storyblok.com/docs/guide/getting-started?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js)**: Get a project ready in less than 5 minutes.
- **[Storyblok CLI](https://github.com/storyblok/storyblok)**: A simple CLI for scaffolding Storyblok projects and fieldtypes.

## ℹ️ More Resources

### Support

- Bugs or Feature Requests? [Submit an issue](/../../issues/new).
- Do you have questions about Storyblok or you need help? [Join our Discord Community](https://discord.gg/jKrbAMz).

### Contributing

Please see our [contributing guidelines](https://github.com/storyblok/.github/blob/main/contributing.md) and our [code of conduct](https://www.storyblok.com/trust-center#code-of-conduct?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js).
This project use [semantic-release](https://semantic-release.gitbook.io/semantic-release/) for generate new versions by using commit messages and we use the Angular Convention to naming the commits. Check [this question](https://semantic-release.gitbook.io/semantic-release/support/faq#how-can-i-change-the-type-of-commits-that-trigger-a-release) about it in semantic-release FAQ
