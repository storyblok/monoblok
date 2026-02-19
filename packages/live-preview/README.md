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

- Lazy-loads the Storyblok Preview Bridge
- Safe to use in SSR environments

## Installation

```bash
npm install @storyblok/live-preview
# or
yarn add @storyblok/live-preview
```

## Usage

### Live preview (client frameworks)

Use this when you know the story ID and want to update client-side state on live edits.

```ts
import { subscribeToStoryblokPreview } from '@storyblok/live-preview';

subscribeToStoryblokPreview(123, (story) => {
  // update local state
});
```
## Documentation

This package is intentionally minimal.
More helpers and examples will be added over time as usage expands.

## Community

For help, best practices, or discussions:

* [Storyblok GitHub Discussions](https://github.com/storyblok/monoblok/discussions)
* [Join the Storyblok Discord](https://storyblok.com/join-discord)

## Support

For bugs or feature requests, please
[submit an issue](https://github.com/storyblok/monoblok/issues/new/choose).

## License

[MIT](/LICENSE)
