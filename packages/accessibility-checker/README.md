<div align="center">

![Storyblok ImagoType](https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png)

<h1 align="center">@storyblok/accessibility-checker</h1>
 <p>
   Accessibility checks for the Storyblok Visual Editor, powered by axe-core.
 </p>
 <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/accessibility-checker">
    <img src="https://img.shields.io/npm/v/@storyblok/accessibility-checker/latest.svg?style=flat-square&color=8d60ff" alt="Storyblok Accessibility Checker" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/accessibility-checker" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/accessibility-checker.svg?style=appveyor&color=8d60ff" alt="npm">
  </a>
  <a href="https://storyblok.com/join-discord">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a>
</p>

## Installation

```bash
npm install @storyblok/accessibility-checker
```

## Usage

Enable the checker in code that runs in the browser:

```ts
import { createAccessibilityChecker } from "@storyblok/accessibility-checker";

const accessibilityChecker = createAccessibilityChecker();
accessibilityChecker.enable();

// later, for example when a component unmounts
accessibilityChecker.disable();
```

It runs [axe-core](https://github.com/dequelabs/axe-core) when the Visual Editor requests a check
and sends the results to the editor's A11y tab. Outside the Visual Editor, `enable()` does nothing.

## Documentation

For complete documentation, including the options and the message protocol, please visit the
[Accessibility Checker reference](https://www.storyblok.com/docs/libraries/js/accessibility-checker).

## Playground

To try the checker in the Visual Editor, copy `playground/.env.template` to `playground/.env`, set
`VITE_STORYBLOK_TOKEN`, and run `pnpm --filter @storyblok/playground-accessibility-checker dev`. Set
the space's preview URL to `https://localhost:5173/`.

## Community

For help, best practices, or discussions:

- [Storyblok GitHub Discussions](https://github.com/storyblok/monoblok/discussions)
- [Join the Storyblok Discord](https://storyblok.com/join-discord)

## Support

For bugs or feature requests, please
[submit an issue](https://github.com/storyblok/monoblok/issues/new/choose).

## License

[MIT](/LICENSE). The package depends on [axe-core](https://github.com/dequelabs/axe-core), which is
licensed under the [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/).
