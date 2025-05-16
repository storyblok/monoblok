<div align="center">
  <a href="https://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js" align="center">
    <img src="https://a.storyblok.com/f/88751/1776x360/296788fb19/sb-js.png"  alt="Storyblok Logo">
  </a>
  <h1 align="center">@storyblok/js</h1>
  <p align="center">
    The JavaScript SDK you need to interact with <a href="http://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js" target="_blank">Storyblok API</a> and enable the <a href="https://www.storyblok.com/docs/guide/essentials/visual-editor?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js" target="_blank">Real-time Visual Editing Experience</a>.
  </p>
  <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/js">
    <img src="https://img.shields.io/npm/v/@storyblok/js/latest.svg?style=flat-square" alt="Storyblok JS" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/js" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/js.svg?style=flat-square" alt="npm">
  </a>
</p>

<p align="center">
  <a href="https://discord.gg/jKrbAMz">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=09b3af">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-09b3af?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-09b3af?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## Kickstart a new project
Are you eager to dive into coding? **[Follow these steps to kickstart a new project with Storyblok and a JavaScript frontend framework](https://www.storyblok.com/technologies?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js)**, and get started in just a few minutes!

## Installation

Install `@storyblok/js`:

```bash
npm install @storyblok/js
// yarn add @storyblok/js
```

> ⚠️ This SDK uses the Fetch API under the hood. If your environment doesn't support it, you need to install a polyfill like [isomorphic-fetch](https://github.com/matthew-andrews/isomorphic-fetch). More info on [storyblok-js-client docs](https://github.com/storyblok/storyblok-js-client#fetch-use-polyfill-if-needed---version-5).

### From a CDN

Install the file from the CDN:

```html
<script src="https://unpkg.com/@storyblok/js"></script>
```

## Initialization

Register the plugin on your application and add the [access token](https://www.storyblok.com/docs/api/content-delivery#topics/authentication?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js) of your Storyblok space. You can also add the `apiPlugin` in case that you want to use the Storyblok API Client:

```js
import { apiPlugin, storyblokInit } from '@storyblok/js';

const { storyblokApi } = storyblokInit({
  accessToken: 'YOUR_ACCESS_TOKEN',
  use: [apiPlugin],
});
```

That's it! All the features are enabled for you: the _Api Client_ for interacting with [Storyblok CDN API](https://www.storyblok.com/docs/api/content-delivery#topics/introduction?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js), and _Storyblok Bridge_ for [real-time visual editing experience](https://www.storyblok.com/docs/guide/essentials/visual-editor?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js).

> You can enable/disable some of these features if you don't need them, so you save some KB. Please read the "Features and API" section

### Region parameter

Possible values:

- `eu` (default): For spaces created in the EU
- `us`: For spaces created in the US
- `ap`: For spaces created in Australia
- `ca`: For spaces created in Canada
- `cn`: For spaces created in China

Full example for a space created in the US:

```js
import { apiPlugin, storyblokInit } from '@storyblok/js';

const { storyblokApi } = storyblokInit({
  accessToken: 'YOUR_ACCESS_TOKEN',
  use: [apiPlugin],
  apiOptions: {
    region: 'us',
  },
});
```

> Note: For spaces created in the United States or China, the `region` parameter **must** be specified.

## Getting Started

`@storyblok/js` does three actions when you initialize it:

- Provides a `storyblokApi` object in your app, which is an instance of [storyblok-js-client](https://github.com/storyblok/storyblok-js-client).
- Loads [Storyblok Bridge](https://www.storyblok.com/docs/Guides/storyblok-latest-js?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js) for real-time visual updates.
- Provides a `storyblokEditable` function to link editable components to the Storyblok Visual Editor.

### 1. Fetching Content

Inject `storyblokApi`:

```js
import { apiPlugin, storyblokInit } from '@storyblok/js';

const { storyblokApi } = storyblokInit({
  accessToken: 'YOUR_ACCESS_TOKEN',
  use: [apiPlugin],
});

const { data } = await storyblokApi.get('cdn/stories', { version: 'draft' });
```

> Note: if you don't use `apiPlugin`, you can use your prefered method or function to fetch your data.

### 2. Listen to Storyblok Visual Editor events

Use `useStoryblokBridge` or `registerStoryblokBridge` to get the new story every time is triggered a `change` event from the Visual Editor. You need to pass the story id as first param, and a callback function as second param to update the new story:

```js
import { apiPlugin, storyblokInit, useStoryblokBridge } from '@storyblok/js';

const { storyblokApi } = storyblokInit({
  accessToken: 'YOUR_ACCESS_TOKEN',
  use: [apiPlugin],
});

const { data } = await storyblokApi.get('cdn/stories', { version: 'draft' });

const story = data ? data.story : null;

useStoryblokBridge(story.id, story => (state.story = story));
```

You can pass [Bridge options](https://www.storyblok.com/docs/Guides/storyblok-latest-js?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js) as a third parameter as well:

```js
useStoryblokBridge(story.id, story => (state.story = story), {
  resolveRelations: ['Article.author'],
  resolveLinks: 'url'
});
```

### 3. Link your components to Storyblok Visual Editor

To link your app and Storyblok components together will depend on the framework you are using. But, in the end, you must add the `data-blok-c` and `data-blok-uid` attributes, and the `storyblok__outline` class.

We provide you a `storyblokEditable` function to make that easier. As an example, you can check in [@storyblok/vue](https://github.com/storyblok/storyblok-vue/blob/master/lib/index.js#L7-L9) how we use a `v-editable` directive for that:

```js
import { storyblokEditable } from '@storyblok/js';

const vEditableDirective = {
  bind(el, binding) {
    if (binding.value) {
      const options = storyblokEditable(binding.value);
      el.setAttribute('data-blok-c', options['data-blok-c']);
      el.setAttribute('data-blok-uid', options['data-blok-uid']);
      el.classList.add('storyblok__outline');
    }
  },
};
```

At this point, you'll have your app connected to Storyblok with the real-time editing experience fully enabled.

## Features and API

You can **choose the features to use** when you initialize the plugin. In that way, you can improve Web Performance by optimizing your page load and save some bytes.

### Storyblok API

You can use an `apiOptions` object. This is passed down to the (storyblok-js-client config object](https://github.com/storyblok/storyblok-js-client#class-storyblok):

```js
const { storyblokApi } = storyblokInit({
  accessToken: 'YOUR_ACCESS_TOKEN',
  apiOptions: {
    // storyblok-js-client config object
    cache: { type: 'memory' },
  },
  use: [apiPlugin],
});
```

If you prefer to use your own fetch method, just remove the `apiPlugin` and `storyblok-js-client` won't be added to your application.

```js
storyblokInit({});
```

### Storyblok Bridge

You can conditionally load it by using the `bridge` option. Very useful if you want to disable it in production:

```js
const { storyblokApi } = storyblokInit({
  bridge: process.env.NODE_ENV !== 'production',
});
```

If you don't use `useStoryblokBridge` or `registerStoryblokBridge`, you have still access to the raw `window.StoryblokBridge`:

```js
const sbBridge = new window.StoryblokBridge(options);

sbBridge.on(['input', 'published', 'change'], (event) => {
  // ...
});
```

### Rendering Rich Text

You can easily render rich text by using the `renderRichText` function that comes with `@storyblok/js`:

```js
import { renderRichText } from '@storyblok/js';

const renderedRichText = renderRichText(blok.richtext);
```

You can set a **custom Schema and component resolver globally** at init time by using the `richText` init option:

```js
import { RichTextSchema, storyblokInit } from '@storyblok/js';
import cloneDeep from 'clone-deep';

const mySchema = cloneDeep(RichTextSchema); // you can make a copy of the default RichTextSchema
// ... and edit the nodes and marks, or add your own.
// Check the base RichTextSchema source here https://github.com/storyblok/storyblok-js-client/blob/master/source/schema.js

storyblokInit({
  accessToken: '<your-token>',
  richText: {
    schema: mySchema,
    resolver: (component, blok) => {
      switch (component) {
        case 'my-custom-component':
          return `<div class="my-component-class">${blok.text}</div>`;
        default:
          return 'Resolver not defined';
      }
    },
  },
});
```

You can also set a **custom Schema and component resolver only once** by passing the options as the second parameter to `renderRichText` function:

```js
import { renderRichText } from '@storyblok/js';

renderRichText(blok.richTextField, {
  schema: mySchema,
  resolver: (component, blok) => {
    switch (component) {
      case 'my-custom-component':
        return `<div class="my-component-class">${blok.text}</div>`;
      default:
        return `Component ${component} not found`;
    }
  },
});
```

## The Storyblok JavaScript SDK Ecosystem

![A visual representation of the Storyblok JavaScript SDK Ecosystem](https://a.storyblok.com/f/88751/2400x1350/be4a4a4180/sdk-ecosystem.png/m/1200x0)

## Further Resources

- [Quick Start](https://www.storyblok.com/technologies?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js)
- [API Documentation](https://www.storyblok.com/docs/api?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js)
- [Developer Tutorials](https://www.storyblok.com/tutorials?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js)
- [Developer Guides](https://www.storyblok.com/docs/guide/introduction?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js)
- [FAQs](https://www.storyblok.com/faqs?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js)

## Support

- Bugs or Feature Requests? [Submit an issue](/../../issues/new).
- Do you have questions about Storyblok or you need help? [Join our Discord Community](https://discord.gg/jKrbAMz).

## Contributing

Please see our [contributing guidelines](https://github.com/storyblok/.github/blob/main/contributing.md) and our [code of conduct](https://www.storyblok.com/trust-center#code-of-conduct?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js).
This project use [semantic-release](https://semantic-release.gitbook.io/semantic-release/) for generate new versions by using commit messages and we use the Angular Convention to naming the commits. Check [this question](https://semantic-release.gitbook.io/semantic-release/support/faq#how-can-i-change-the-type-of-commits-that-trigger-a-release) about it in semantic-release FAQ
