<div align="center">

![Storyblok ImagoType](https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png)

<h1 align="center">@storyblok/live-preview</h1>
 <p>
   Lightweight helpers to enable Storyblok Live Preview and Visual Editor
   updates across client-side and SSR frameworks.
 </p>
 <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/live-preview">
    <img src="https://img.shields.io/npm/v/@storyblok/live-preview/latest.svg?style=flat-square&color=8d60ff" alt="Storyblok Live Preview" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/live-preview" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/live-preview.svg?style=appveyor&color=8d60ff" alt="npm">
  </a>
  <a href="https://storyblok.com/join-discord">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a>
</p>

## Features

- Receive live story updates from the Visual Editor with `onStoryblokEditorEvent`
- Share one Preview Bridge instance across all subscribers on a page
- Load the Preview Bridge directly with `loadStoryblokBridge`
- Mark blocks and fields as editable with `storyblokEditable` and `editableField`
- Detect the Visual Editor with `isInEditor`

## Usage

```bash
npm install @storyblok/live-preview
```

Subscribe to story updates from the Visual Editor:

```ts
import { onStoryblokEditorEvent } from "@storyblok/live-preview";

const stopListening = await onStoryblokEditorEvent(
  (story) => {
    // update local state
  },
  { resolveRelations: ["featured.articles"] },
);

// later, for example when the component unmounts
stopListening();
```

Outside the Visual Editor, `onStoryblokEditorEvent` does nothing and resolves to a cleanup function
that does nothing. All subscribers on a page share one Preview Bridge instance, so subscribe once
per component and call the cleanup function when the component unmounts.

For full control, load the Preview Bridge directly:

```ts
import { loadStoryblokBridge } from "@storyblok/live-preview";

const bridge = await loadStoryblokBridge();

bridge.on(["input", "change", "published"], (event) => {
  // custom preview handling
});
```

## Contributing

If you'd like to contribute, please refer to the [contributing guidelines](../../CONTRIBUTING.md).

## Community

For help, discussion about best practices, or any other conversation that would benefit from being
searchable:

- [Discuss Storyblok on GitHub Discussions](https://github.com/storyblok/monoblok/discussions)

For community support, chatting with other users, please visit:

- [Discuss Storyblok on Discord](https://storyblok.com/join-discord)

## Support

For bugs or feature requests, please
[submit an issue](https://github.com/storyblok/monoblok/issues/new/choose).

> [!IMPORTANT] Please search existing issues before submitting a new one. Issues without a minimal
> reproducible example will be closed.
> [Why reproductions are Required](https://antfu.me/posts/why-reproductions-are-required).

### I can't share my company project code

We understand that you might not be able to share your company's project code. Please provide a
minimal reproducible example that demonstrates the issue by using tools like
[Stackblitz](https://stackblitz.com) or a link to a GitHub repo. Please make sure you include a
README file with the instructions to build and run the project, important not to include any access
token, password or personal information of any kind.

### Feedback

If you have a question, please ask in the
[Discuss Storyblok on Discord](https://storyblok.com/join-discord) channel.

## License

[License](./LICENSE)
